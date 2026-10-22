// src/pages/api/v2/laf/applications/list.js
// - Role scoping is fail-closed (see src/lib/ci-scope.js); only root/admin are unscoped
// - Same `where` is used for rows and the count, so `total` is scoped too
// - List response no longer includes biometric / ID-number fields
// - limit + offset pagination, +1 fetch for hasMore, parallel count

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS } from '@/lib/graph.fields';
import { findUserById }  from '@/lib/graph.functions';
import { resolveBranchWhere, getShortCode } from '@/lib/ci-scope';
import { TEMP_LOAN_APP_LIST_FIELDS as TEMP_LIST_FIELDS } from '@/lib/ci-list-fields';

const graph = new GraphProvider();

const TEMP_TYPE   = createGraphType('temporaryLoanApplications', TEMP_LIST_FIELDS)('temporaryLoanApplications');
const CI_TYPE     = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');
const GROUP_TYPE  = createGraphType('groups', '_id name')('groups');

export default apiHandler({ get: listApplications });

async function listApplications(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
        status,
        search,
        limit:  limitStr  = '20',
        offset: offsetStr = '0',
    } = req.query;

    const limit  = Math.min(Math.max(parseInt(limitStr,  10) || 20, 1), 100);
    const offset = Math.max(parseInt(offsetStr, 10) || 0, 0);

    // ── Scope by role (fail closed) ───────────────────────────────────────
    const branchWhere = await resolveBranchWhere(currentUser);
    if (branchWhere === null) {
        console.warn('[laf/list] scope denied', {
            userId: currentUser._id,
            rep: currentUser.role?.rep,
            shortCode: getShortCode(currentUser),
        });
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // TEMP DIAGNOSTIC: remove after confirming the area_admin case
    if (currentUser.role?.rep === 2 && branchWhere.branchId?._in) {
        console.info('[laf/list] rep2 scope', {
            shortCode: getShortCode(currentUser),
            areaId: currentUser.areaId,
            branchCount: branchWhere.branchId._in.length,
        });
    }

    // ── Build where clause ────────────────────────────────────────────────
    let where = { ...branchWhere };

    if (status && status !== 'all') {
        // 'pending' excludes pending_validation, which lives in the
        // "Flagged as Duplicate" tab
        where = { ...where, status: { _eq: status } };
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

    // ── Data + count in parallel (same `where`) ───────────────────────────
    const [rawApplications, total] = await Promise.all([
        graph.query(
            queryQl(TEMP_TYPE, {
                where,
                order_by: [{ submittedAt: 'desc' }],
                limit:  limit + 1,   // +1 detects hasMore
                offset,
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []),

        graph.query(
            aggregateQl(
                createGraphType('temporaryLoanApplications', '_id')('tempCount'),
                'aggregate { count }',
                where
            )
        ).then(r => r.data?.tempCount?.aggregate?.count ?? null)
         .catch(() => null),
    ]);

    const hasMore      = rawApplications.length > limit;
    const applications = hasMore ? rawApplications.slice(0, limit) : rawApplications;

    // ── Claim expiry: stale claims are treated as unassigned ──────────────
    const now          = Date.now();
    const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

    const normalizedApps = applications.map(a => {
        const claimExpired = a.assignedTo && a.assignedAt &&
            (now - new Date(a.assignedAt).getTime()) > CLAIM_TTL_MS;
        return claimExpired
            ? { ...a, assignedTo: null, assignedAt: null, assignedByName: null }
            : a;
    });

    // ── Batch fetch CI investigations ─────────────────────────────────────
    const ciRefs = normalizedApps.map(a => a.ciReferenceCode).filter(Boolean);
    let ciMap = {};
    if (ciRefs.length > 0) {
        const investigations = await graph.query(
            queryQl(CI_TYPE, { where: { ciReferenceCode: { _in: ciRefs } } })
        ).then(r => r.data?.ciInvestigations ?? []);
        ciMap = Object.fromEntries(investigations.map(ci => [ci.ciReferenceCode, ci]));
    }

    // ── Batch fetch branch + group names ──────────────────────────────────
    const allBranchIds = [...new Set(normalizedApps.map(a => a.branchId).filter(Boolean))];
    const allGroupIds  = [...new Set(normalizedApps.map(a => a.groupId).filter(Boolean))];
    let branchMap = {};
    let groupMap  = {};
    await Promise.all([
        allBranchIds.length > 0
            ? graph.query(queryQl(BRANCH_TYPE, { where: { _id: { _in: allBranchIds } } }))
                .then(r => { branchMap = Object.fromEntries((r.data?.branches ?? []).map(b => [b._id, b])); })
            : Promise.resolve(),
        allGroupIds.length > 0
            ? graph.query(queryQl(GROUP_TYPE, { where: { _id: { _in: allGroupIds } } }))
                .then(r => { groupMap = Object.fromEntries((r.data?.groups ?? []).map(g => [g._id, g])); })
            : Promise.resolve(),
    ]);

    // ── Enrich ────────────────────────────────────────────────────────────
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

    res.status(200).json({
        success: true,
        applications: enriched,
        total,
        hasMore,
        limit,
        offset,
    });
}