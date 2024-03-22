import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `_id code`)('branches');
const GROUP_TYPE = createGraphType('groups', `_id`)('groups');

export default apiHandler({
    post: deleteBranch
});

async function deleteBranch(req, res) {
    const { _id } = req.body;
    const statusCode = 200;
    let response = {};

    const [branch] = await graph.query(
        queryQl(BRANCH_TYPE, {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.branches);

    if(!branch) {
        response = {
            error: true,
            message: `Branch with id: "${_id}" not exists`
        };
    } else {
        const [group] = await graph.query(GROUP_TYPE, { branchId: { _eq: branch._id } })
                .then(res => res.data.groups);
        if(group) {
            response = {
                error: true,
                message: `Can't delete branch ${branches[0].name} it is currently used in groups.`
            };
        } else {
            await graph.mutation(
                deleteQl(BRANCH_TYPE, {
                    where: {
                        _id: { _eq: _id }
                    }
                })
            );

            response = {
                success: true
            }
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
