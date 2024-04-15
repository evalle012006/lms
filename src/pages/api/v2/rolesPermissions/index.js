import { ROLE_PERMISSION_FIELD } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const ROLE_PERMISSION_TYPE = createGraphType('rolesPermission', `
${ROLE_PERMISSION_FIELD}
`)('rolesPermission');

export default apiHandler({
    get: getRolePermissions,
    post: updateRolePermissions
});

async function getRolePermissions(req, res) {
    const { id } = req.query;
    let statusCode = 200;
    let response = {};

    const rolePermissions = await graph.query(
        queryQl(ROLE_PERMISSION_TYPE, {
            where: {
                _id: { _eq: id }
            }
        })
    ).then(res => res.data.rolesPermissions);

    response = { success: true, rolePermissions: rolePermissions[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateRolePermissions(req, res) {
    let statusCode = 200;
    let response = {};

    const role = req.body;
    const roleId = role._id;
    delete role._id;

    const [roleResp] = await graph.mutation(
        updateQl(ROLE_PERMISSION_TYPE, {
            set: {
                ... role
            },
            where: {
                _id: { _eq: roleId }
            },
        })
    ).then(res => res.data.rolesPermissions.returning)

    response = { success: true, rolePermissions: roleResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}