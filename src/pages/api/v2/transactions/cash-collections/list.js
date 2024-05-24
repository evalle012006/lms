import { CASH_COLLECTIONS_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    get: list
});

const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `
${CASH_COLLECTIONS_FIELDS}
branch {
    ${BRANCH_FIELDS
}
client {
    ${CLIENT_FIELDS}
}
group {
    ${GROUP_FIELDS}
}
`)('collections')

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { branchId, loId, mode } = req.query;

    if (mode === 'daily') {
        cashCollections = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    branchId: { _eq: branchId }
                }
            })
        ).then(res => res.data.collections);
    } 

    response = {
        success: true,
        loans: loans
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
