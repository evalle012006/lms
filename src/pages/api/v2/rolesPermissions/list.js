import { ROLE_PERMISSION_FIELD } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const ROLE_PERMISSION_TYPE = createGraphType('rolesPermission', `
${ROLE_PERMISSION_FIELD}
`)('rolesPermission');

export default apiHandler({
    get: list
});

async function list(req, res) {

    let statusCode = 200;
    let response = {};


    const roles = await graph.query(
        queryQl(ROLE_PERMISSION_TYPE, {})
    ).then(res => res.data.rolesPermissions);
    
    response = {
        success: true,
        roles: roles
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}