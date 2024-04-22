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
`)('clients');

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { searchText, mode } = req.query;
    const fullNameCondition = [...  searchText.split(' ')].join('%');

    const clients = await graph.query(
        queryQl(CLIENT_TYPE, {
            where: {
                status: mode === 'offset' ? {  _eq: 'offset' } : { _neq: 'null' },
                fullName: { _ilike: `%${fullNameCondition}%` },
                groupId: { _is_null: false }
            }
        })
    )
    .then(res => {
        if(res.errors) {
            throw res.errors
        }
        
        return res;
    })
    .then(res => res.data.clients);
    
    response = {
        success: true,
        clients: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}