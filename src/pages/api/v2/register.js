import { sendVerificationEmail } from '@/lib/email-templates';
import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { sendMail } from '@/lib/send-mail';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

const PLATFORM_ROLES_TYPE = createGraphType('platformRoles', `_id `)('roles');

export default apiHandler({
    post: register
});

async function register(req, res) {
    // split out password from user details 
    const { password, email, firstName, lastName } = req.body;
    const bcrypt = require("bcryptjs");

    const [user] = await graph.query(
        queryQl(USER_TYPE, { where: { email: { _eq: email } } }),
    ).then(res => res.data.users);

    // validate 

    let response = {};
    let statusCode = 200;

    if (!!user) {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${email}" already exists`
        };
        logger.error({page: 'register', ...response});
    } else {
        // set role
        const [role] = await graph.query(
            queryQl(PLATFORM_ROLES_TYPE, { where: { rep: { _eq: 1 } } })
        ).then(res.data.roles);

        const [user] = await graph.mutation(
            insertQl(USER_TYPE, {
                objects: [{
                    _id: generateUUID(),
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
                    role: role
                }]
            })
        ).then(res => res.data.users.returning)

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