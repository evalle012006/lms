import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `_id firstName lastName areaId divisionId designatedBranchId regionId`)('users');
const REGION_TYPE = createGraphType('regions', `_id name divisionId`)('regions');

export default apiHandler({
    get: getRegions
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

async function getRegions(req, res) {
    const user_id = req.auth.sub;
    const user = await findUserByID(user_id);
    
    const where = [];

    if(user.regionId) {
        where.push({
            _id: { _eq: user.regionId }
        })
    }

    if(user.areaId) {
        where.push({
            branches: {
                areaId: { _eq: user.areaId }
            }
        })
    }

    if(user.divisionId) {
        where.push({
            branches: {
                divisionId: { _eq: user.divisionId }
            }
        })
    }

    if(user.designatedBranchId) {
        where.push({
            branches: {
                _id: { _eq: user.designatedBranchId }
            }
        })
    }

    const result =  await graph.query(
        queryQl(REGION_TYPE, { where: where?.[0] ?? undefined })
    ).then(res => res.data.regions ?? []);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));

}