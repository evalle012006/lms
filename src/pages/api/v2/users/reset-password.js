import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    post: resetUserPassword
});

async function resetUserPassword(req, res) {
    let statusCode = 200;
    let response = {};

    const user = req.body;
    const userId = user._id;

    const [userResp] = await graph.mutation(
        updateQl(USER_TYPE, {
            set: {
                password: ""
            },
            where: {
                _id: { _eq: userId }
            }
        })
    ).then(res => res.data.users.returning);

    response = { success: true, user: userResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}