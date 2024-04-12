import { ROLE_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const ROLE_TYPE = createGraphType('roles', `
${ROLE_FIELDS}
`)('roles');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};
    const roles = await graph.query(
        queryQl(ROLE_TYPE, {
            order_by: [{
                name: 'asc'
            }]  
        })
    ).then(res => res.data.roles);

    response = {
        success: true,
        roles: roles
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
