import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteRole
});

async function deleteRole(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const rolesPermissions = await db
        .collection('rolesPermissions')
        .find({ _id: new ObjectId(_id) })
        .toArray();

    if (rolesPermissions.length > 0) {
        await db
            .collection('rolesPermissions')
            .deleteOne({ _id: new ObjectId(_id) });

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
