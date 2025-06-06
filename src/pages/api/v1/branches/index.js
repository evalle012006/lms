import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getBranch,
    post: updateBranch
});

async function getBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id, code, date } = req.query;
    let statusCode = 200;
    let response = {};

    let branch;

    if (_id) {
        branch = await db.collection('branches')
            .aggregate([
                { $match: { _id: new ObjectId(_id) } },
                { $addFields: { _idStr: { $toString: '$_id' } } },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 3]} } }
                        ],
                        as: "branchManager"
                    }
                },
                { $unwind: '$branchManager' },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 4]} } },
                            { $group: {
                                _id: null,
                                count: { $sum: 1 }
                            } }
                        ],
                        as: "noOfLO"
                    }
                },
                { $unwind: '$noOfLO' },
                {
                    $lookup: {
                        from: "branchCOH",
                        localField: '_idStr',
                        foreignField: "branchId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: "cashOnHand"
                    }
                }
            ])
            .toArray();
    } else if (code) {
        branch = await db.collection('branches')
            .aggregate([
                { $match: { code: code } },
                { $addFields: { _idStr: { $toString: '$_id' } } },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 3]} } }
                        ],
                        as: "branchManager"
                    }
                },
                { $unwind: '$branchManager' },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 4]} } },
                            { $group: {
                                _id: null,
                                count: { $sum: 1 }
                            } }
                        ],
                        as: "noOfLO"
                    }
                },
                { $unwind: '$noOfLO' },
                {
                    $lookup: {
                        from: "branchCOH",
                        localField: '_idStr',
                        foreignField: "branchId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: "cashOnHand"
                    }
                }
            ])
            .toArray();
    }

    response = { success: true, branch: branch[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const branch = req.body;
    const branchId = branch._id;
    delete branch._id;

    const branchResp = await db
        .collection('branches')
        .updateOne(
            { _id: new ObjectId(branchId) }, 
            {
                $set: { ...branch }
            }, 
            { upsert: false });

    response = { success: true, branch: branchResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}