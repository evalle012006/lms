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

    const roles = await db
        .collection('roles')
        .find({ _id: ObjectId(_id) })
        .toArray();

    if (roles.length > 0) {
        if (roles[0].system) {
            response = {
                error: true,
                message: `You can't delete "${roles[0].name}" role because it's a system role.`
            };
        } else {
            await db
                .collection('roles')
                .deleteOne({ _id: ObjectId(_id) });

            response = {
                success: true
            }
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
