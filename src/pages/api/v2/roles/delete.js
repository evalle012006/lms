import { ROLE_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const ROLE_TYPE = createGraphType('roles', `
${ROLE_FIELDS}
`)('roles');

export default apiHandler({
    post: deleteRole
});

async function deleteRole(req, res) {
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const roles = await graph.query(
        queryQl(ROLE_TYPE, {
            where: { _id: { _eq: _id } }
        })
    ).then(resp => resp.data.roles);

    if (roles.length > 0) {
        if (roles[0].system) {
            response = {
                error: true,
                message: `You can't delete "${roles[0].name}" role because it's a system role.`
            };
        } else {
            await graph.mutation(
                deleteQl(ROLE_TYPE, {
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
            message: `Role with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
