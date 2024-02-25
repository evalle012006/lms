import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { branchCode, branchId, loOnly, selectedLoGroup } = req.query;
    let users;

    if (branchCode) {
        if (selectedLoGroup && selectedLoGroup !== 'all') {
            if (selectedLoGroup == 'main') {
                users = await db
                .collection('users')
                .find({ 'root': { $ne: true }, "role.rep": 4, designatedBranch: branchCode, loNo: { $lt: 11 } } )
                .project({ password: 0 })
                .sort({ loNo: 1 })
                .toArray();
            } else if (selectedLoGroup == 'ext') {
                users = await db
                .collection('users')
                .find({ 'root': { $ne: true }, "role.rep": 4, designatedBranch: branchCode, loNo: { $gt: 10 } } )
                .project({ password: 0 })
                .sort({ loNo: 1 })
                .toArray();
            }
        } else if (loOnly) {
            users = await db
                .collection('users')
                .find({ 'root': { $ne: true }, "role.rep": 4, designatedBranch: branchCode })
                .project({ password: 0 })
                .sort({ loNo: 1 })
                .toArray();
        } else {
            users = await db
                .collection('users')
                .find({ 'root': { $ne: true }, designatedBranch: branchCode })
                .project({ password: 0 })
                .toArray();
        }
    } else if (branchId) {
        users = await db
            .collection('users')
            .find({ 'root': { $ne: true }, "role.rep": 4, designatedBranchId: branchId })
            .project({ password: 0 })
            .sort({ loNo: 1 })
            .toArray();
    } else {
        users = await db
            .collection('users')
            .find({ 'root': { $ne: true } })
            .project({ password: 0 })
            .toArray();
    }
    
    response = {
        success: true,
        users: users
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
