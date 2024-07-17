import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { BRANCH_COH_FIELDS, BRANCH_FIELDS } from '@/lib/graph.fields';


const graph = new GraphProvider();
const addDatedAddedCondition = (date) => !date ? ` { _is_null: true } ` : ` { _eq: "${date}" }`; 
const BRANCH_TYPE = (date) => createGraphType('branches', `
    ${BRANCH_FIELDS}
    noOfLO: users_aggregate(where: {
        role: {
            _contains: {
                rep: 4
            }
        }
    }) {
        aggregate {  count }
    }
    
    cashOnHand: branchCOHs (where: { dateAdded: ${addDatedAddedCondition(date) } }){
        ${BRANCH_COH_FIELDS}
    }
`)('branches');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { branchCode = null, branchCodes = null, date } = req.query;
    const codes = [branchCode, ... (branchCodes?.split(',') ?? [])].filter(code => !!code);
    const where = codes.length ? { code: { _in: codes } } : { code: { _is_null: false } };

    const branches = await graph.query(
        queryQl(BRANCH_TYPE(date), { 
            where,
            order_by: [{ code: 'asc' }]
        }, )
    ).then(res => res.data.branches)
      .then(branches => 
        branches.map(branch => ({
            ... branch,
            noOfLO: {
                count: branch.noOfLO.aggregate.count,
            }
        })
      ));
    
    response = {
        success: true,
        branches
    };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));

}
