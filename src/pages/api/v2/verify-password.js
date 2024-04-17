import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import getConfig from 'next/config';

const bcrypt = require('bcryptjs');
const { serverRuntimeConfig } = getConfig();


const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
password
`)('users');

export default apiHandler({
    post: authenticate,
    get: logout
});

let response = {};
let statusCode = 200;

async function authenticate(req, res) {
    const { username, password } = req.body;

    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                email: username
            }
        })
    ).then(res => res.data.users);

    if (user && !user.password) {
        response = { success: false, error: 'NO_PASS', user: user._id };
        res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));
    }

    if (!(user && bcrypt.compareSync(password, user.password))) {
        response = {
            error: true,
            message: 'Email or Password is incorrect'
        };
    } else {
        response = {
            success: true
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}