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

    const { branchId, loId, currentUserId, mode } = req.query;
    let groups;

    if (mode === 'all') {
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
        } else if (currentUserId) {
            const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
            if (user.length > 0) {
                let branchIds = [];
                if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                    const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                    branchIds = branches.map(branch => branch._id.toString());
                } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                    const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                    branchIds = branches.map(branch => branch._id.toString());
                } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                    const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                    branchIds = branches.map(branch => branch._id.toString());
                }

                groups = await db
                        .collection('groups')
                        .find({ $expr: {$in: ['$branchId', branchIds]} })
                        .sort({ groupNo: 1 })
                        .toArray();
            }
        } else {
            groups = await db
                .collection('groups')
                .find({ status: 'available' })
                .sort({ groupNo: 1 })
                .toArray();
        }
    } else {
        if (branchId && loId) {
            groups = await db
                .collection('groups')
                .find({ branchId: branchId, status: 'available', loanOfficerId: loId })
                .sort({ groupNo: 1 })
                .toArray();
        } else if (branchId) {
            groups = await db
                .collection('groups')
                .find({ branchId: branchId, status: 'available' })
                .sort({ groupNo: 1 })
                .toArray();
        } else if (currentUserId) {
            const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
            if (user.length > 0) {
                let branchIds = [];
                if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                    const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                    branchIds = branches.map(branch => branch._id.toString());
                } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                    const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                    branchIds = branches.map(branch => branch._id.toString());
                } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                    const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                    branchIds = branches.map(branch => branch._id.toString());
                }

                groups = await db
                        .collection('groups')
                        .find({ $expr: {$and: [{$eq: ['$status', 'available']}, {$in: ['$branchId', branchIds]}]} })
                        .sort({ groupNo: 1 })
                        .toArray();
            }
        } else {
            groups = await db
                .collection('groups')
                .find({ status: 'available' })
                .sort({ groupNo: 1 })
                .toArray();
        }
    }
    
    response = {
        success: true,
        groups: groups
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}