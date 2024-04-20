import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
groupCount: groups_aggregate {
    aggregate {
      count
    }
}
`)('users');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { branchCode } = req.query;
    let users;

    if (branchCode) {
        users = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    designatedBranch: { _eq: branchCode }
                }
            })
        ).then(res => res.data.users ?? [])
         .then(users => users.map( u => ({
            ... u,
            groupCount: u.groupCount.aggregate.count
         }) ));

    }
    
    response = {
        success: true,
        users: users
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
