// src/pages/api/public/laf/branch-list.js
// GET — public (with x-laf-api-key)
// Returns minimal branch list for Balik client lookup branch filter.

import { publicApiHandler } from '@/services/public-api-handler';
import { GraphProvider }    from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');

export default publicApiHandler({ get: getBranchList });

async function getBranchList(req, res) {
    const branches = await graph.query(
        queryQl(BRANCH_TYPE, { order_by: [{ name: 'asc' }] })
    ).then(r => r.data?.branches ?? []);

    return res.status(200).json({
        success: true,
        branches: branches.map(b => ({ _id: b._id, name: b.name, code: b.code })),
    });
}