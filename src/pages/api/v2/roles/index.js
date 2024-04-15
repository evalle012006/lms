import { ROLE_FIELDS, ROLE_PERMISSION_FIELD } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const ROLE_TYPE = createGraphType('roles', `
${ROLE_FIELDS}
rolesPermissions {
    ${ROLE_PERMISSION_FIELD}
}
`)('roles');

export default apiHandler({
    get: getRole,
    post: updateRole
});

async function getRole(req, res) {
    const { id } = req.query;
    let statusCode = 200;
    let response = {};

    const role = await graph.query(
        queryQl(ROLE_TYPE, {
            where: { _id: { _eq: id } }
        })
    ).then(res => res.data.roles);

    response = { success: true, role: role[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateRole(req, res) {
    let statusCode = 200;
    let response = {};

    const role = req.body;
    const roleId = role._id;
    delete role._id;

    const roleResp = await graph.mutation(
        updateQl(ROLE_TYPE, {
            set: {
                ... role
            },
            where: {
                _id: { _eq: roleId }
            }
        })
    ).then(res => res.data.roles.returning?.[0]);


    response = { success: true, role: roleResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}