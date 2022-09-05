import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteBranch
});

async function deleteBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const roles = await db
        .collection('branches')
        .find({ _id: ObjectId(_id) })
        .toArray();

    if (roles.length > 0) {
        await db
            .collection('branches')
            .updateOne(
                { _id: _id },
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
            message: `Role with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
