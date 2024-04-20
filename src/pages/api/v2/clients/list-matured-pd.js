import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { LOAN_FIELDS } from '@/lib/graph.fields';


const graph = new GraphProvider();
const LOAN_TYPE = createGraphType('loans', `
${LOAN_FIELDS}
client {
    _id
    fullName
}
`)('loans');

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { groupId = null } = req.query;

    let statusCode = 200;
    let response = {};

    const data = await graph.query(
        queryQl(LOAN_TYPE, {
            where: {
                groupId: { _eq: groupId },
                maturedPD: { _eq: true },
                status: { _eq: 'closed' },
                maturedPastDue: { _gt: 0 }
            }
        })
    )
    .then(res => res.data.loans);
    
    response = {
        success: true,
        data: data
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

export const config = {
    api: {
      bodyParser: {
        sizeLimit: '20mb',
      },
    },
}