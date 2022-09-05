import getConfig from 'next/config';
import { errorHandler } from '@/services/error-handler';
import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

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
        const token = jwt.sign({ sub: user._id }, serverRuntimeConfig.secret, { expiresIn: '7d' });
        // delete user._id;
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

        response = {
            success: true,
            user: { ...user, token }
        }
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

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}