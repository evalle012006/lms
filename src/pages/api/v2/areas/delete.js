import { AREA_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const AREA_TYPE = createGraphType('areas', `
${AREA_FIELDS}
managers { _id }
branches { _id }
`)('areas');

export default apiHandler({
    post: deleteBranch
});

async function deleteBranch(req, res) {

    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const [area] = await graph.query(
        queryQl(AREA_TYPE, {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.areas);
    

    if (!!area) {
        const users = area.managers;
        const branches = area.branches;

        if (users.length > 0 || branches.length > 0) {
            response = {
                error: true,
                message: `Can't delete area ${area.name} it is currently link to a user/branches.`
            };
        } else {
            await graph.mutation(
                deleteQl(AREA_TYPE, {
                    _id: { _eq: _id }
                })
            );

            response = {
                success: true
            }
        }
    } else {
        response = {
            error: true,
            message: `Area with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}