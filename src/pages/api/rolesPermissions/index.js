import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getRolePermissions,
    post: updateRolePermissions
});

async function getRolePermissions(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { id } = req.query;
    let statusCode = 200;
    let response = {};
    const rolePermissions = await db.collection('rolesPermissions').find({ _id: new ObjectId(id)}).toArray();
    response = { success: true, rolePermissions: rolePermissions[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateRolePermissions(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const role = req.body;

    const roleResp = await db
        .collection('rolesPermissions')
        .updateOne(
            { role: role.role }, 
            {
                $set: { ...role }
            }, 
            { upsert: true });

    response = { success: true, rolePermissions: roleResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}