import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('_id firstName lastName branchId:designatedBranchId areaId divisionId regionId')('users');
const BRANCH_TYPE = createGraphType('_id code name areaId divisionId regionId')('branches');

export default apiHandler({
    get: getOptions
});

const findUserByID = async (id) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                _id: { _eq: id }
            }
        })
    ).then(res => res.data.users);
    
    return user;
}

async function getOptions(req, res) {
    const user_id = req.auth.sub;
    const user = findUserByID(user_id);
    let result = [];
    const { type } = req.query;

    if (type === 'lo') {

    }

    if (type === 'branch') {

    }

    if(type === 'area') {

    }

    if (type === 'division') {

    }

    if (type === 'region') {

    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));

}