import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: resetUserPassword
});

async function resetUserPassword(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const user = req.body;
    const userId = user._id;

    const userResp = await db
        .collection('users')
        .updateOne(
            { _id: ObjectId(userId) }, 
            {
                $unset: { password: "" }
            }, 
            { upsert: false });

    response = { success: true, user: userResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}