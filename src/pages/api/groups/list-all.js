import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const { branchId, loId, areaManagerId } = req.query;
    let groups;

    if (branchId && loId) {
        groups = await db
            .collection('groups')
            .find({ branchId: branchId, loanOfficerId: loId })
            .sort({ groupNo: 1 })
            .toArray();
    } else if (branchId) {
        groups = await db
            .collection('groups')
            .find({ branchId: branchId })
            .sort({ groupNo: 1 })
            .toArray();
    } else if (areaManagerId) {
        const areaManager = await db.collection("users").find({ _id: new ObjectId(areaManagerId) }).toArray();
        if (areaManager.length > 0) {
            const branchCodes = typeof areaManager[0].designatedBranch === 'string' ? JSON.parse(areaManager[0].designatedBranch) : areaManager[0].designatedBranch;
            const branches = await db.collection("branches").find({ $expr: { $in: ['$code', branchCodes] } }).toArray();
            if (branches.length > 0) {
                const branchIds = branches.map(b => b._id + '');
                groups = await db
                    .collection('groups')
                    .find({ $expr: {$in: ['$branchId', branchIds]} })
                    .sort({ groupNo: 1 })
                    .toArray();
            }
        }
    } else {
        groups = await db
            .collection('groups')
            .find({ status: 'available' })
            .sort({ groupNo: 1 })
            .toArray();
    }
    
    response = {
        success: true,
        groups: groups
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}