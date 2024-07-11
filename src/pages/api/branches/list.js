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
    let branches;

    const { currentUserId, branchCode, date } = req.query;

    if (branchCode) {
        branches = await db
            .collection('branches')
            // .find({ code: branchCode })
            // .sort({ code: 1 })
            .aggregate([
                { $match: { code: branchCode } },
                { $addFields: { _idStr: { $toString: '$_id' } } },
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
                    $sort: { code: 1 }
                },
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
    } else if (currentUserId) {
        // const codes = branchCodes.trim().split(",");
        const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
        if (user.length > 0) {
            let codes = [];
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                codes = branches.map(branch => branch.code);
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                codes = branches.map(branch => branch.code);
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                codes = branches.map(branch => branch.code);
            }

            branches = await db.collection('branches')
                .aggregate([
                    { $match: { $expr: {$in: ["$code", codes]} } },
                    { $addFields: { _idStr: { $toString: '$_id' } } },
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
                    },
                    {
                        $sort: { code: 1 }
                    }
                ])
                .toArray();
        }
    } else {
        branches = await db
            .collection('branches')
            .aggregate([
                { $addFields: { _idStr: { $toString: '$_id' } } },
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
                },
                {
                    $sort: { code: 1 }
                }
            ])
            // .find()
            // .sort({ code: 1 })
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
