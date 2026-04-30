import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

// Minimal fields needed for the approver dropdown
const USER_TYPE = createGraphType('users', `
    _id
    firstName
    lastName
    role
    areaId
    regionId
    divisionId
    designatedBranchId
    designatedBranch
`)('users');

const BRANCH_TYPE = createGraphType('branches', `
    _id
    code
    areaId
    regionId
    divisionId
`)('branches');

export default apiHandler({
    get: getApprovers,
});

async function getApprovers(req, res) {
    const { branchCode, branchId } = req.query;

    if (!branchCode && !branchId) {
        return res.status(200).json({ success: false, message: 'branchCode or branchId required', users: [] });
    }

    // Step 1 — Get the branch record to find hierarchy IDs
    const branchWhere = branchCode
        ? { code: { _eq: branchCode } }
        : { _id: { _eq: branchId } };

    const [branch] = await graph.query(
        queryQl(BRANCH_TYPE, { where: branchWhere })
    ).then(r => r.data?.branches ?? []);

    if (!branch) {
        return res.status(200).json({ success: false, message: 'Branch not found', users: [] });
    }

    // Step 2 — Fetch BM only from this branch (exclude cashier and LOs)
    const bmQuery = graph.query(
        queryQl(USER_TYPE, {
            where: {
                designatedBranch: { _eq: branch.code },
                role: { _contains: { shortCode: 'branch_manager' } },
            },
        })
    ).then(r => r.data?.users ?? []);

    // Step 3 — Fetch AM (area_admin) matching areaId
    const amQuery = branch.areaId
        ? graph.query(
            queryQl(USER_TYPE, {
                where: {
                    areaId: { _eq: branch.areaId },
                    role: { _contains: { shortCode: 'area_admin' } },
                },
            })
        ).then(r => r.data?.users ?? [])
        : Promise.resolve([]);

    // Step 4 — Fetch RM (regional_manager) matching regionId
    const rmQuery = branch.regionId
        ? graph.query(
            queryQl(USER_TYPE, {
                where: {
                    regionId: { _eq: branch.regionId },
                    role: { _contains: { shortCode: 'regional_manager' } },
                },
            })
        ).then(r => r.data?.users ?? [])
        : Promise.resolve([]);

    // Step 5 — Fetch OD/Deputy Director matching divisionId
    const odQuery = branch.divisionId
        ? graph.query(
            queryQl(USER_TYPE, {
                where: {
                    divisionId: { _eq: branch.divisionId },
                    role: { _contains: { shortCode: 'deputy_director' } },
                },
            })
        ).then(r => r.data?.users ?? [])
        : Promise.resolve([]);

    const [bmUsers, amUsers, rmUsers, odUsers] = await Promise.all([
        bmQuery, amQuery, rmQuery, odQuery,
    ]);

    // Deduplicate by _id
    const seen = new Set();
    const users = [...bmUsers, ...amUsers, ...rmUsers, ...odUsers]
        .filter(u => {
            if (seen.has(u._id)) return false;
            seen.add(u._id);
            return true;
        })
        .map(u => ({
            _id:       u._id,
            firstName: u.firstName,
            lastName:  u.lastName,
            role:      u.role,
            value:     u._id,
        }));

    return res.status(200).json({ success: true, users });
}