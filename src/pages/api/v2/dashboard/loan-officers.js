import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `_id firstName lastName areaId divisionId designatedBranchId regionId role`)('users');

export default apiHandler({
    get: getLoanOfficers
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

async function getLoanOfficers(req, res) {
    const user_id = req.auth.sub;
    const user = await findUserByID(user_id);
    
    const _and = [{
        role: {
            _contains: {
                rep: 4
            }
        }
    }];

    if (user.regionId) {
        _and.push({
            groups: {
                branch: {
                    regionId: { _eq: user.regionId }
                }
            }
        })
    }

    if (user.areaId) {
        _and.push({
            groups: {
                branch: {
                    areaId: { _eq: user.areaId }
                }
            }
        })
    }

    if (user.divisionId) {
        _and.push({
            groups: {
                branch: {
                    divisionId: { _eq: user.divisionId }
                }
            }
        })
    }

    if (user.designatedBranchId) {
        _and.push( user.role.rep === 4 ? { _id: { _eq: user._id } } : {
            designatedBranchId: {
                _eq: user.designatedBranchId
            }
        })
    }
    
    _and.push({
        status: { _eq: 'active' }
    });

    const result =  await graph.query(
        queryQl(USER_TYPE, { where: { _and },  order_by: [{ loNo: 'asc' }] })
    ).then(res => res.data.users ?? []);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));

}