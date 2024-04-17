import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const PERMISSION_TYPE = createGraphType('permissions', `
_id
`)('permissions');

export default apiHandler({
    get: list
});

async function list(req, res) {

    const permissions = await graph.query(
        queryQl(PERMISSION_TYPE, { })
    ).then(res => res.data.permissions);

    let statusCode = 200;
    let response = {};


    response = {
        success: true,
        permissions: permissions
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}