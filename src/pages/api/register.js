import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { sendMail } from '@/lib/send-mail';
import { sendVerificationEmail } from '@/lib/email-templates';
import { getCurrentDate } from '@/lib/date-utils';
import logger from '@/logger';

export default apiHandler({
    post: register
});

async function register(req, res) {
    // split out password from user details 
    const { password, email, firstName, lastName } = req.body;
    const bcrypt = require("bcryptjs");

    // validate 
    const { db } = await connectToDatabase();
    const users = await db
        .collection('users')
        .find({ email: email })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (users.length > 0) {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${email}" already exists`
        };
        logger.error({page: 'register', ...response});
    } else {
        // set role
        const role = await db.collection('platformRoles').find({ rep: 1 }).project({ _id: 0 }).toArray();

        const user = await db.collection('users').insertOne({
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(8), null),
            number: '',
            position: '',
            logged: false,
            status: 'verification',
            lastLogin: null,
            dateAdded: getCurrentDate(),
            role: role[0]
        });

        const subject = 'HybridAG Account Verification';
        const template = sendVerificationEmail(email);
        const emailResponse = await sendMail(email, subject, template);

        logger.debug({page: 'register', message: 'User succcessfuly registered!', user: email});

        response = {
            success: true,
            user: user,
            email: email
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}