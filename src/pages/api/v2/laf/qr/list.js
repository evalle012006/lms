import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `
    _id name code address qrToken qrGeneratedAt
`)('branches');

export default apiHandler({ get: listBranchesWithQR });

async function listBranchesWithQR(req, res) {
    const currentUser = req.auth;

    // Build filter based on role
    let where = {};
    if (currentUser.role?.rep === 3 || currentUser.role?.rep === 4) {
        where = { code: { _eq: currentUser.designatedBranch } };
    }

    const branches = await graph.query(
        queryQl(BRANCH_TYPE, {
            where,
            order_by: [{ name: 'asc' }],
        })
    ).then(r => r.data?.branches ?? []);

    res.status(200).json({ success: true, branches });
}