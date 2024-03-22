import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';


const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `
    _id
    address
    code
    dateAdded
    email
    name
    phoneNumber
    noOfLO: users_aggregate(where: {
        role: {
            _contains: {
                rep: 4
            }
        }
    }) {
        aggregate {  count }
    }
`)('branches');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { branchCode, branchCodes } = req.query;

    const codes = [branchCode, ... (branchCodes?.split(',') ?? [])].filter(code => !!code);
    const where = codes.length ? { codes: { _in: codes } } : { code: { _is_null: false } };

    const branches = await graph.query(
        queryQl(BRANCH_TYPE, { where })
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
