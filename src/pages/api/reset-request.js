import { apiHandler } from '@/services/api-handler';
import { sendMail } from '@/lib/send-mail';
import { sendForgotPasswordRequest } from '@/lib/email-templates';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: resetRequest
});

async function resetRequest(req, res) {
    const ObjectId = require('mongodb').ObjectId;
    const { email } = req.body;
    const { db } = await connectToDatabase();
    const users = await db
        .collection('users')
        .find({ email: email })
        .toArray();

    let statusCode = 200;
    let response = {};

    if (users.length > 0) {
        const user = users[0];
        const subject = 'HybridAG Password Reset';
        const template = sendForgotPasswordRequest(ObjectId(user._id));
        const emailResponse = await sendMail(email, subject, template);

        response = {
            success: true,
            message: 'succesfully sent email'
        };
    } else {
        response = {
            error: true,
            message: 'user not found'
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}