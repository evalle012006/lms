import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteUser
});

async function deleteUser(req, res) {
    const { _id, email } = req.body;

    const { db } = await connectToDatabase();

    let statusCode = 200;
    let response = {};

    const user = await db
        .collection('users')
        .find({ email: email })
        .toArray();

    if (user.length > 0) {
        await db
            .collection('users')
            .updateOne(
                { email: email },
                {
                    $set: { deleted: true },
                    $currentDate: { dateModified: true }
                }
            );

        response = {
            success: true
        }
    } else {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${email}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
