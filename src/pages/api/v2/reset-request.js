import { sendForgotPasswordRequest } from '@/lib/email-templates';
import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { sendMail } from '@/lib/send-mail';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    post: resetRequest
});

async function resetRequest(req, res) {
    const { email } = req.body;

    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                email: { _eq: email }
            }
        })
    ).then(res => res.data.users);

    let statusCode = 200;
    let response = {};

    if (!!user) {
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