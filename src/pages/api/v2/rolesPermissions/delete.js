import { ROLE_PERMISSION_FIELD } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { deleteQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const ROLE_PERMISSION_TYPE = createGraphType('rolesPermission', `
${ROLE_PERMISSION_FIELD}
`)('rolesPermission');

export default apiHandler({
    post: deleteRole
});

async function deleteRole(req, res) {
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const rolesPermissions = await graph.query(
        queryQl(ROLE_PERMISSION_TYPE, {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.rolesPermissions);

    if (rolesPermissions.length > 0) {
        await graph.mutation(
            deleteQl(ROLE_PERMISSION_TYPE, { _id: { _eq: _id } })
        );

        response = {
            success: true
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
