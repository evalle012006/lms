import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE   = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
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
            queryQl(BRANCH_TYPE, {
                where: buildBranchWhereForRep2(currentUser),
            })
        ).then(r => r.data?.branches ?? []);
        const branchIds = branches.map(b => b._id);
        branchWhere = { branchId: { _in: branchIds } };
    } else if (currentUser.role.rep === 4) {
        // LO can only see applications for their branch (if allowLoCI is enabled)
        branchWhere = { branchId: { _eq: currentUser.designatedBranchId } };
    }

    const where = {
        ...branchWhere,
        ...(status ? { status: { _eq: status } } : {}),
    };

    const applications = await graph.query(
        queryQl(TEMP_TYPE, {
            where,
            order_by: [{ submittedAt: 'desc' }],
            limit: 200,
        })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    // Batch fetch CI investigations for all applications
    const ciRefs = applications.map(a => a.ciReferenceCode).filter(Boolean);
    let ciMap = {};
    if (ciRefs.length > 0) {
        const investigations = await graph.query(
            queryQl(CI_TYPE, {
                where: { ciReferenceCode: { _in: ciRefs } }
            })
        ).then(r => r.data?.ciInvestigations ?? []);
        ciMap = Object.fromEntries(
            investigations.map(ci => [ci.ciReferenceCode, ci])
        );
    }

    // Batch fetch branch names
    const allBranchIds = [...new Set(applications.map(a => a.branchId).filter(Boolean))];
    let branchMap = {};
    if (allBranchIds.length > 0) {
        const branches = await graph.query(
            queryQl(BRANCH_TYPE, {
                where: { _id: { _in: allBranchIds } }
            })
        ).then(r => r.data?.branches ?? []);
        branchMap = Object.fromEntries(branches.map(b => [b._id, b]));
    }

    const enriched = applications.map(a => {
        const ci = ciMap[a.ciReferenceCode];
        return {
            ...a,
            branchName:    branchMap[a.branchId]?.name || '—',
            branchCode:    branchMap[a.branchId]?.code || '—',
            // ── CI investigation data ──────────────────────────────────
            picUserName:   ci?.picUserName   || null,
            decision:      ci?.decision      || null,
            investigatedAt:ci?.investigatedAt|| null,
            selfieKey:     ci?.selfieKey     || null,
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