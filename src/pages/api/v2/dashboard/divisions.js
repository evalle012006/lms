import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `_id firstName lastName areaId divisionId designatedBranchId regionId root`)('users');
const DIVISION_TYPE = createGraphType('divisions', `_id name`)('divisions');

export default apiHandler({
    get: getDivisions
});

const findUserByID = async (id) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                _id: { _eq: id }
            }
        })
    ).then(res => res.data.users.map(u => ({
        ... u,
        areaId: u.root ? null : u.areaId,
        divisionId: u.root ? null : u.divisionId,
        designatedBranchId: u.root ? null : u.designatedBranchId,
        regionId: u.root ? null : u.regionId,
    })));
    
    return user;
}

async function getDivisions(req, res) {
    const user_id = req.auth.sub;
    const user = await findUserByID(user_id);
    
    const _and = [];

    if (user.divisionId) {
        _and.push({
            _id: { _eq: user.divisionId }
        })
    }

    const result =  await graph.query(
        queryQl(DIVISION_TYPE, { where: { _and },  order_by: [{ name: 'asc' }] })
    ).then(res => res.data.divisions ?? []);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));

}