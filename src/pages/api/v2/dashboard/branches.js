import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `_id firstName lastName areaId divisionId designatedBranchId regionId`)('users');
const BRANCHES_TYPE = createGraphType('branches', `_id name code areaId regionId divisionId`)('branches');

export default apiHandler({
    get: getBranches
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

async function getBranches(req, res) {
    const user_id = req.auth.sub;
    const user = await findUserByID(user_id);
    
    const where = [];

    if(user.regionId) {
        where.push({
            regionId: { _eq: user.regionId }
        })
    }

    if(user.areaId) {
        where.push({
            areaId: { _eq: user.areaId }
        })
    }

    if(user.divisionId) {
        where.push({
            divisionId: { _eq: user.divisionId }
        })
    }

    if(user.designatedBranchId) {
        where.push({
            _id: { _eq: user.designatedBranchId }
        })
    }

    where.push({
        status: { _eq: 'active' },
        role: {
            _contains: {
                rep: 3
            }
        }
    });

    const result =  await graph.query(
        queryQl(BRANCHES_TYPE, { where: where?.[0] ?? undefined,  order_by: [{ code: 'asc' }] })
    ).then(res => res.data.branches ?? []);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));

}