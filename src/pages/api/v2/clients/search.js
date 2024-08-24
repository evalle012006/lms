import { CLIENT_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    get: list
});

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    group {
        name
    }
    branch {
        name
    }
    dateModified
`)('clients')

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { searchText, mode, cursor, limit = 20 } = req.query;
    const fullNameCondition = `%${searchText}%`;

    const query = {
        where: {
            status: mode === 'offset' ? { _eq: 'offset' } : { _neq: 'null' },
            fullName: { _ilike: fullNameCondition },
            ...(cursor ? { dateModified: { _lt: cursor } } : {})
        },
        order_by: { dateModified: 'desc' },
        limit: parseInt(limit)
    };

    const clients = await graph.query(
        queryQl(CLIENT_TYPE, query)
    ).then(res => res.data.clients ?? [])
    
    response = {
        success: true,
        clients: clients.map(c => ({
            ...c,
            group: c.group ?? {},
            branch: c.branch ?? {},
        })),
        nextCursor: clients.length === parseInt(limit) ? clients[clients.length - 1].dateModified : null
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        .setHeader('Pragma', 'no-cache')
        .setHeader('Expires', '0')
        .end(JSON.stringify(response));
}