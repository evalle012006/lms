import getConfig from 'next/config';
import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';

const jwt = require('jsonwebtoken');
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
        .find({ email: username.trim() })
        .toArray();

    const user = users.length > 0 ? users[0] : null;

    if (user) {
        if (!user.password) {
            response = { success: false, error: 'NO_PASS', user: user._id };
            logger.error({page: 'login', message: 'NO_PASS', user: username});
        } else if (!(bcrypt.compareSync(password.trim(), user.password))) {
            response = { error: true, message: 'Username or Password is incorrect' };
            logger.error({page: 'login', message: 'Password is incorrect', user: username});
        } else {
            const token = jwt.sign({ sub: user._id }, serverRuntimeConfig.secret, { expiresIn: '7d' });
            delete user.password;
            const query = await db
                .collection('users')
                .updateOne(
                    { _id: user._id },
                    {
                        $set: { logged: true },
                        $currentDate: { lastLogin: true }
                    },
                );
            response = { success: true, user: { ...user, token } };
            logger.debug({page: 'login', message: 'User succcessfuly login!', user: username});
        }
    } else {
        response = { error: true, message: 'User not found!' };
        logger.error({page: 'login', message: 'User not found!', user: username});
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function logout(req, res) {
    const { db } = await connectToDatabase();
    const { user } = req.query;
    const ObjectId = require('mongodb').ObjectId;

    const query = await db
        .collection('users')
        .updateOne(
            { _id: ObjectId(user) },
            { $set: { logged: false } }
        );

    response = { success: true, query, user };
    logger.debug({page: 'login', message: 'User succcessfuly logout!'});

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}