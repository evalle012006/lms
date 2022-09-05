import { apiHandler } from '@/services/api-handler';
import { sendMail } from '@/lib/send-mail';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: resetPassword
});

async function resetPassword(req, res) {
    const ObjectId = require('mongodb').ObjectId;
    const bcrypt = require("bcryptjs");

    const { objectId, password } = req.body;
    const { db } = await connectToDatabase();
    const dbResponse = await db.collection('users').updateOne(
        { _id: ObjectId(objectId) },
        {
            $set: { 'password': bcrypt.hashSync(password, bcrypt.genSaltSync(8), null) },
            $currentDate: { dateModified: true }
        }
    );

    let statusCode = 200;
    let response = {};

    if (dbResponse.matchedCount === 0) {
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