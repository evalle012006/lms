import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    get: list
});

async function list(req, res) {

    let statusCode = 200;
    let response = {};

    const { userType } = req.query;
    const user_type_role = {
        area: 'area_admin',
        region: 'regional_manager',
        deputy: 'deputy_director',
    };

    const user_role = user_type_role[userType];
    const where = user_role ? {
        role: {
            _contains: {
                shortCode: user_role
            }
        }
    }: {}

    const users = await graph.query(
        queryQl(USER_TYPE, {
            where
        })
    ).then(res => res.data.users);
    
    response = {
        success: true,
        users: users
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
