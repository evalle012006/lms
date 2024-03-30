import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getList
});

let statusCode = 200;
let response = {};

async function getList(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;

    if (_id) {
        const user = await db.collection('users').find({ _id: new ObjectId(_id) }).toArray();
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

            const transferClients = await db
                .collection('transferClients')
                .aggregate([
                    { $match: { $expr: {$and: [{$eq: ['$status', 'approved']}, {$in: ['$sourceBranchId', branchIds]}]} } },
                    {
                        $addFields: {
                            "clientIdObj": { $toObjectId: "$selectedClientId" },
                            "loanIdObj": { $toObjectId: "$loanId" },
                            "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                            "targetGroupIdObj": { $toObjectId: "$targetGroupId" }
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            as: "client"
                        }
                    },
                    {
                        $unwind: "$client"
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: 'loanIdObj',
                            foreignField: '_id',
                            as: 'loans'
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: 'sourceGroupIdObj',
                            foreignField: '_id',
                            as: 'sourceGroup'
                        }
                    },
                    {
                        $unwind: "$sourceGroup"
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: 'targetGroupIdObj',
                            foreignField: '_id',
                            as: 'targetGroup'
                        }
                    },
                    {
                        $unwind: "$targetGroup"
                    },
                    { $project: { clientIdObj: 0, loanIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0 } }
                ])
                .toArray();

            response = { success: true, data: transferClients };
            
        } else {
            response = { error: true, message: "No data found." };
        }
    } else {
        const transferClients = await db
            .collection('transferClients')
            .aggregate([
                { $match: { $expr: { $eq: ['$status', 'approved'] } } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$selectedClientId" },
                        "loanIdObj": { $toObjectId: "$loanId" },
                        "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                        "targetGroupIdObj": { $toObjectId: "$targetGroupId" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'loanIdObj',
                        foreignField: '_id',
                        as: 'loans'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'sourceGroupIdObj',
                        foreignField: '_id',
                        as: 'sourceGroup'
                    }
                },
                {
                    $unwind: "$sourceGroup"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'targetGroupIdObj',
                        foreignField: '_id',
                        as: 'targetGroup'
                    }
                },
                {
                    $unwind: "$targetGroup"
                },
                { $project: { clientIdObj: 0, loanIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0 } }
            ])
            .toArray();

            response = { success: true, data: transferClients };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}