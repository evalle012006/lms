import { BRANCH_FIELDS, CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    get: getLoan,
    post: updateLoan
});

const graph = new GraphProvider();
const LOAN_TYPE = createGraphType('loans', `
${LOAN_FIELDS}
branch {
    ${BRANCH_FIELDS
}
client {
    ${CLIENT_FIELDS}
}
group {
    ${GROUP_FIELDS}
}
`)('loans')

async function getLoan(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const loan = await graph.query(
        queryQl(LOAN_TYPE, {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.loans?.[0])

        
    response = { success: true, loan };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateLoan(req, res) {
    let statusCode = 200;
    let response = {};

    const loan = req.body;
    const loanId = loan._id;
    delete loan._id;

    const loanResp = await graph.mutation(
        updateQl(LOAN_TYPE, {
            set: {
                ... loan
            },
            where: {
                _id: { _eq: loanId }
            }
        })
    );

    response = { success: true, loan: loanResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}