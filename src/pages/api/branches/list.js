import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    let branches;

    const { branchCode, branchCodes } = req.query;

    if (branchCode) {
        branches = await db
            .collection('branches')
            .find({ code: branchCode })
            .toArray();
    } else if (branchCodes) {
        const codes = branchCodes.trim().split(",");
        branches = await db.collection('branches').find({ $expr: {$in: ["$code", codes]} }).toArray();
    } else {
        branches = await db
            .collection('branches')
            .find()
            .toArray();

    }
    
    response = {
        success: true,
        branches: branches
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
