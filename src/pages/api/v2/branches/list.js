import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { BRANCH_COH_FIELDS, BRANCH_FIELDS } from '@/lib/graph.fields';
import moment from 'node_modules/moment/moment';
import { getCurrentDate } from '@/lib/utils';


const graph = new GraphProvider();

const addCOH = (date) => {
    const currDate = moment(getCurrentDate()).format('YYYY-MM-DD');
    if(date === currDate) {
        return `
            cashOnHand: branchCOHs (order_by: [{ dateAdded: desc_nulls_last }], limit: 1) {
                ${BRANCH_COH_FIELDS}
            }
        `
    }

    return `
    cashOnHand: branchCOHs (where: { dateAdded: { _eq: "${date}" } }) {
        ${BRANCH_COH_FIELDS}
    }
    `
}

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
    
    ${addCOH(date)}
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
