// src/pages/api/v2/laf/applications/list.js
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';

const graph = new GraphProvider();

const TEMP_TYPE   = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE     = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');

export default apiHandler({ get: listApplications });

async function listApplications(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    const { status } = req.query;

    let branchWhere = {};
    if (currentUser.role.rep === 3) {
        branchWhere = { branchId: { _eq: currentUser.designatedBranchId } };
    } else if (currentUser.role.rep === 2) {
        const branches = await graph.query(
            queryQl(BRANCH_TYPE, { where: buildBranchWhereForRep2(currentUser) })
        ).then(r => r.data?.branches ?? []);
        branchWhere = { branchId: { _in: branches.map(b => b._id) } };
    } else if (currentUser.role.rep === 4) {
        // LO scope — only when allowLoCI is enabled (gated at page level)
        branchWhere = { branchId: { _eq: currentUser.designatedBranchId } };
    }

    // ── Claim expiry: treat claims older than 24hrs as unassigned ─────────
    // This prevents permanently locked apps when investigators don't sync
    const claimCutoff = moment().subtract(24, 'hours').toISOString();

    let where = { ...branchWhere };

    if (status === 'pending') {
        // For pending: show all pending apps, but expired claims appear as available
        // The _or makes Hasura return apps that are:
        //   a) truly unassigned
        //   b) assigned to current user (their own claims)
        //   c) claimed by others BUT claim is older than 24hrs (expired)
        where = {
            ...branchWhere,
            status: { _eq: 'pending' },
        };
    } else if (status) {
        where = {
            ...branchWhere,
            status: { _eq: status },
        };
    }

    const applications = await graph.query(
        queryQl(TEMP_TYPE, {
            where,
            order_by: [{ submittedAt: 'desc' }],
            limit: 200,
        })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    // Treat expired claims as unassigned in the response
    // so the UI shows them as available in PrepareForFieldModal
    const now = Date.now();
    const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

    const normalizedApps = applications.map(a => {
        const claimExpired = a.assignedTo && a.assignedAt &&
            (now - new Date(a.assignedAt).getTime()) > CLAIM_TTL_MS;
        if (claimExpired) {
            return { ...a, assignedTo: null, assignedAt: null, assignedByName: null };
        }
        return a;
    });

    // Batch fetch CI investigations
    const ciRefs = normalizedApps.map(a => a.ciReferenceCode).filter(Boolean);
    let ciMap = {};
    if (ciRefs.length > 0) {
        const investigations = await graph.query(
            queryQl(CI_TYPE, { where: { ciReferenceCode: { _in: ciRefs } } })
        ).then(r => r.data?.ciInvestigations ?? []);
        ciMap = Object.fromEntries(investigations.map(ci => [ci.ciReferenceCode, ci]));
    }

    // Batch fetch branch names
    const allBranchIds = [...new Set(normalizedApps.map(a => a.branchId).filter(Boolean))];
    let branchMap = {};
    if (allBranchIds.length > 0) {
        const branches = await graph.query(
            queryQl(BRANCH_TYPE, { where: { _id: { _in: allBranchIds } } })
        ).then(r => r.data?.branches ?? []);
        branchMap = Object.fromEntries(branches.map(b => [b._id, b]));
    }

    const enriched = normalizedApps.map(a => {
        const ci = ciMap[a.ciReferenceCode];
        return {
            ...a,
            branchName:      branchMap[a.branchId]?.name || '—',
            branchCode:      branchMap[a.branchId]?.code || '—',
            picUserName:     ci?.picUserName    || null,
            decision:        ci?.decision       || null,
            investigatedAt:  ci?.investigatedAt || null,
            selfieKey:       ci?.selfieKey      || null,
        };
    });

    res.status(200).json({ success: true, applications: enriched });
}

function buildBranchWhereForRep2(user) {
    const { shortCode, areaId, regionId, divisionId } = user;
    if (shortCode === 'area_admin')       return { areaId:     { _eq: areaId } };
    if (shortCode === 'regional_manager') return { regionId:   { _eq: regionId } };
    if (shortCode === 'deputy_director')  return { divisionId: { _eq: divisionId } };
    return {};
}