import getConfig from 'next/config';
import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

const bcrypt = require('bcryptjs');
const { serverRuntimeConfig } = getConfig();

export default apiHandler({
    post: authenticate,
    get: logout
});

let response = {};
let statusCode = 200;

async function authenticate(req, res) {
    const { db } = await connectToDatabase();
    const { username, password } = req.body;
    const users = await db
        .collection('users')
        .find({ email: username })
        .toArray();

    const user = users.length > 0 ? users[0] : null;

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