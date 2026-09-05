// src/pages/api/v2/laf/applications/list.js
// FIX: Added limit + offset pagination params
// FIX: Parallel count query returns total for infinite scroll hasMore detection
// FIX: Removed hardcoded limit: 200 — now uses limit param (default 20)

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS } from '@/lib/graph.fields';
import { findUserById }  from '@/lib/graph.functions';
import moment            from 'moment';

const graph = new GraphProvider();

const TEMP_TYPE  = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE    = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');
const GROUP_TYPE  = createGraphType('groups', '_id name')('groups');

export default apiHandler({ get: listApplications });

async function listApplications(req, res) {
    const currentUser = await findUserById(req.auth.sub);

    const {
        status,
        search,
        limit:  limitStr  = '20',
        offset: offsetStr = '0',
    } = req.query;

    const limit  = Math.min(Math.max(parseInt(limitStr,  10) || 20, 1), 100); // cap at 100
    const offset = Math.max(parseInt(offsetStr, 10) || 0, 0);

    // ── Scope by role ─────────────────────────────────────────────────────
    let branchWhere = {};
    if (currentUser.role.rep === 3) {
        branchWhere = { branchId: { _eq: currentUser.designatedBranchId } };
    } else if (currentUser.role.rep === 2) {
        const branches = await graph.query(
            queryQl(BRANCH_TYPE, { where: buildBranchWhereForRep2(currentUser) })
        ).then(r => r.data?.branches ?? []);
        branchWhere = { branchId: { _in: branches.map(b => b._id) } };
    } else if (currentUser.role.rep === 4) {
        branchWhere = { branchId: { _eq: currentUser.designatedBranchId } };
    }

    // ── Build where clause ────────────────────────────────────────────────
    let where = { ...branchWhere };

    if (status === 'pending') {
        // Pending CI queue — excludes pending_validation, which lives in its
        // own "Flagged as Duplicate" tab so it isn't confused with a normal
        // pending-CI application.
        where = { ...branchWhere, status: { _eq: 'pending' } };
    } else if (status && status !== 'all') {
        where = { ...branchWhere, status: { _eq: status } };
    }

    if (req.query.existingClientId) {
        where = { ...where, existingClientId: { _eq: req.query.existingClientId } };
    }

    if (search?.trim()) {
        const term = search.trim();
        where = {
            ...where,
            _or: [
                { firstName:       { _ilike: `%${term}%` } },
                { lastName:        { _ilike: `%${term}%` } },
                { contactNumber:   { _ilike: `%${term}%` } },
                { ciReferenceCode: { _ilike: `%${term}%` } },
            ],
        };
    }

    // FIX: run data fetch + total count in parallel
    // Fetch limit+1 records — the extra record tells us if there's a next page
    // without needing the aggregate (which may not be tracked in Hasura yet)
    const [rawApplications, total] = await Promise.all([
        graph.query(
            queryQl(TEMP_TYPE, {
                where,
                order_by: [{ submittedAt: 'desc' }],
                limit:  limit + 1,  // +1 to detect hasMore without aggregate
                offset,
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []),

        // FIX: use aggregateQl with a dedicated alias so response key is predictable
        // aggregateQl(type, fields, where) generates:
        //   {alias}: {name}_aggregate(where: ...) { aggregate { count } }
        // Since TEMP_TYPE alias = 'temporaryLoanApplications', response key = alias
        // We pass a custom alias 'tempCount' to make the response key explicit
        // aggregateQl(type, aggregateFields, where)
        // GQL: tempCount: temporaryLoanApplications_aggregate(where: ...) { aggregate { count } }
        // response key = type.alias = 'tempCount'
        graph.query(
            aggregateQl(
                createGraphType('temporaryLoanApplications', '_id')('tempCount'),
                'aggregate { count }',
                where
            )
        ).then(r =>
            r.data?.tempCount?.aggregate?.count ?? null
        ).catch(() => null),
    ]);

    // Detect hasMore from extra record, trim back to requested limit
    const hasMoreFromFetch = rawApplications.length > limit;
    const applications     = hasMoreFromFetch
        ? rawApplications.slice(0, limit)
        : rawApplications;

    // ── Claim expiry: treat stale claims as unassigned ────────────────────
    const now         = Date.now();
    const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

    const normalizedApps = applications.map(a => {
        const claimExpired = a.assignedTo && a.assignedAt &&
            (now - new Date(a.assignedAt).getTime()) > CLAIM_TTL_MS;
        if (claimExpired) {
            return { ...a, assignedTo: null, assignedAt: null, assignedByName: null };
        }
        return a;
    });

    // ── Batch fetch CI investigations ─────────────────────────────────────
    const ciRefs = normalizedApps.map(a => a.ciReferenceCode).filter(Boolean);
    let ciMap = {};
    if (ciRefs.length > 0) {
        const investigations = await graph.query(
            queryQl(CI_TYPE, { where: { ciReferenceCode: { _in: ciRefs } } })
        ).then(r => r.data?.ciInvestigations ?? []);
        ciMap = Object.fromEntries(
            investigations.map(ci => [ci.ciReferenceCode, ci])
        );
    }

    // ── Batch fetch branch names + group names in parallel ───────────────
    const allBranchIds = [...new Set(normalizedApps.map(a => a.branchId).filter(Boolean))];
    const allGroupIds  = [...new Set(normalizedApps.map(a => a.groupId).filter(Boolean))];
    let branchMap = {};
    let groupMap  = {};
    await Promise.all([
        allBranchIds.length > 0
            ? graph.query(queryQl(BRANCH_TYPE, { where: { _id: { _in: allBranchIds } } }))
                .then(r => { branchMap = Object.fromEntries((r.data?.branches ?? []).map(b => [b._id, b])); })
            : Promise.resolve(),
        // FIX: groupName is not stored on the LAF record — fetch from groups table
        allGroupIds.length > 0
            ? graph.query(queryQl(GROUP_TYPE, { where: { _id: { _in: allGroupIds } } }))
                .then(r => { groupMap = Object.fromEntries((r.data?.groups ?? []).map(g => [g._id, g])); })
            : Promise.resolve(),
    ]);

    // ── Enrich ───────────────────────────────────────────────────────────
    const enriched = normalizedApps.map(a => {
        const ci = ciMap[a.ciReferenceCode];
        return {
            ...a,
            branchName:     branchMap[a.branchId]?.name || '—',
            branchCode:     branchMap[a.branchId]?.code || '—',
            groupName:      groupMap[a.groupId]?.name    || '',
            picUserName:    ci?.picUserName    || null,
            decision:       ci?.decision       || null,
            investigatedAt: ci?.investigatedAt || null,
            selfieKey:      ci?.selfieKey      || null,
        };
    });

    // FIX: return hasMore (reliable via +1 fetch) + total (when aggregate tracked)
    res.status(200).json({
        success:      true,
        applications: enriched,
        total,        // null until temporaryLoanApplications_aggregate tracked in Hasura
        hasMore:      hasMoreFromFetch,  // reliable regardless of aggregate tracking
        limit,
        offset,
    });
}

function buildBranchWhereForRep2(user) {
    const { shortCode, areaId, regionId, divisionId } = user;
    if (shortCode === 'area_admin')       return { areaId:     { _eq: areaId } };
    if (shortCode === 'regional_manager') return { regionId:   { _eq: regionId } };
    if (shortCode === 'deputy_director')  return { divisionId: { _eq: divisionId } };
    return {};
}