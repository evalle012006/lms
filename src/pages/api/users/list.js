import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { branchCode } = req.query;
    let users;

    if (branchCode) {
        users = await db
            .collection('users')
            .find({ 'root': { $ne: true }, designatedBranch: branchCode })
            .project({ password: 0 })
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
