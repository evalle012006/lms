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
            .find({ branchId: branchId, status: 'available', loanOfficerId: loId })
            .toArray();
    } else if (branchId) {
        groups = await db
            .collection('groups')
            .find({ branchId: branchId, status: 'available' })
            .toArray();
    } else if (areaManagerId) {
        const areaManager = await db.collection("users").find({ _id: ObjectId(areaManagerId) }).toArray();
        if (areaManager.length > 0) {
            const branchCodes = areaManager[0].designatedBranch;
            const branches = await db.collection("branches").find({ $expr: { $in: ['$code', branchCodes] } }).toArray();
            if (branches.length > 0) {
                const branchIds = branches.map(b => b._id + '');
                groups = await db
                    .collection('groups')
                    .find({ $expr: {$and: [{$eq: ['$status', 'available']}, {$in: ['$branchId', branchIds]}]} })
                    .toArray();
            }
        }
    } else {
        groups = await db
            .collection('groups')
            .find({ status: 'available' })
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