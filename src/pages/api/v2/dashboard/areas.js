import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `_id firstName lastName areaId divisionId designatedBranchId regionId`)('users');
const AREA_TYPE = createGraphType('areas', `_id name regionId divisionId`)('areas');

export default apiHandler({
    get: getAreas
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

async function getAreas(req, res) {
    const user_id = req.auth.sub;
    const user = await findUserByID(user_id);
    

    const _and = [];

    if(user.regionId) {
        _and.push({
            regionId: { _eq: user.regionId }
        })
    }

    if(user.areaId) {
        _and.push({
            _id: { _eq: user.areaId }
        })
    }

    if(user.divisionId) {
        _and.push({
            divisionId: { _eq: user.divisionId }
        })
    }

    if(user.designatedBranchId) {
        _and.push({
            branches: { 
                _id: { _eq: user.designatedBranchId }
            }
        })
    }

    const result =  await graph.query(
        queryQl(AREA_TYPE, { where: { _and },  order_by: [{ name: 'asc' }] })
    ).then(res => res.data.areas ?? []);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));

}