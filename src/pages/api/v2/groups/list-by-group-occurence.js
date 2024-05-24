import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util'
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS)('groups');
const USER_TYPE = createGraphType('users', `designatedBranch`)('users');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { areaManagerId, branchId, loId, occurence, mode } = req.query;
    const codes = await graph.query(
        queryQl(USER_TYPE, {
            where: { _id: areaManagerId ? { _eq: areaManagerId } : { _eq: 'null' } } // fetch non existing user if areaManagerId is null
        })
    )
    .then(res => res.data.users
            .map(u => jsonTryParse(u.designatedBranch, [u.designatedBranch]))
            .reduce((groups, codes) => [... groups, ... codes], [])
    );

    const groups = await graph.query(
        queryQl(GROUP_TYPE, {
            where: {
                branchId: branchId ? { _eq: branchId } : { _neq: 'null' },
                loanOfficerId:  loId ? { _eq: loId } : { _neq: 'null' },
                branch: {
                    code: codes.length ? { _in: codes } : { _neq: 'null' },
                },
                occurence: { _eq: occurence },
                status: (!branchId && !loId && !codes.length) || mode !== 'filter' ? { _eq: 'available' } : { _neq: 'null' }
            },
            order_by: [{ groupNo: 'asc' }]
        })
    ).then(res => res.data.groups)
    
    response = {
        success: true,
        groups: groups
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}