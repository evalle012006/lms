import { CLIENT_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    get: list
});

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', `
${CLIENT_FIELDS}
loans (where: { status: { _eq: "active" } }) {
    ${LOAN_FIELDS}
}
`)('clients');

async function list(req, res) {

    const {groupId = null, branchId = null} = req.query;

    let statusCode = 200;
    let response = {};

    const clients = await graph.query(
        queryQl(CLIENT_TYPE, {
            where: {
                _and: [
                    {
                        status: { _eq: 'active' },
                        delinquent: { _eq: true },
                        loans: {
                            groupId: groupId ? { _eq: groupId } : { _is_null: false },
                            branchId: branchId ? { _eq: branchId } : { _is_null: false },
                            status: { _eq: 'active' }
                        }
                    }
                ]
            }
        })
    )
    .then(res => res.data.clients);

    response = {
        success: true,
        clients: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
