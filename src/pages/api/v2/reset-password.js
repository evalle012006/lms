import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    post: resetPassword
});

async function resetPassword(req, res) {
    const bcrypt = require("bcryptjs");

    const { objectId, password } = req.body;
    console.log(objectId, password);
    const [dbResponse] = await graph.mutation(
        updateQl(USER_TYPE, {
            set: {
                password: bcrypt.hashSync(password, bcrypt.genSaltSync(8), null),
            },
            where: {
                _id: { _eq: objectId ?? null }
            }
        })
    ).then(res => res.data.users.returning);

    let statusCode = 200;
    let response = {};

    if (!dbResponse) {
        response = {
            error: true,
            message: 'User not found!'
        }
    } else {
        response = {
            success: true,
            response: dbResponse
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
};