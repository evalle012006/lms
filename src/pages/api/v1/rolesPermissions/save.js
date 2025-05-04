import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { role, permissions } = req.body;

    const { db } = await connectToDatabase();

    const rolePermissions = await db
        .collection('rolesPermissions')
        .find({ role: role })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (rolePermissions.length > 0) {
        response = {
            error: true,
            fields: ['role'],
            message: `Role permissions already exist`
        };
    } else {
        const rolePermission = await db.collection('rolesPermissions').insertOne({
            role: role,
            permissions: permissions,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });

        response = {
            success: true,
            rolePermission: rolePermission
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}