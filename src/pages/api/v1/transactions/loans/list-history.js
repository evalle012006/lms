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
    let loans;

    const { branchId, groupId, loId, currentUserId, mode, month, year } = req.query;

    if (loId) {
        loans = await db
        .collection('loans')
        .aggregate([
            { $match: {$expr: { $and: [
                {$eq: ['$loId', loId]}, 
                {$ne: ['$status', 'pending']}, 
                {$eq: ['$occurence', mode]},
                {
                    $and: [
                        { $eq: [{ $substr: ["$dateGranted", 0, 4] }, year] },
                        { $eq: [{ $substr: ["$dateGranted", 5, 2] }, month] }
                    ]
                }
            ]}} },
            {
                $addFields: {
                    "branchIdObj": { $toObjectId: "$branchId" },
                    "groupIdObj": { $toObjectId: "$groupId" },
                    "clientIdObj": { $toObjectId: "$clientId" }
                }
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchIdObj",
                    foreignField: "_id",
                    as: "branch"
                }
            },
            {
                $unwind: "$branch"
            },
            {
                $lookup: {
                    from: "groups",
                    localField: "groupIdObj",
                    foreignField: "_id",
                    as: "group"
                }
            },
            {
                $unwind: "$group"
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
                $sort: { "dateAdded": -1 }
            },
            { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
        ])
        .toArray();
    } else if (branchId) {
        loans = await db
        .collection('loans')
        .aggregate([
            { $match: {$expr: { $and: [
                {$eq: ['$branchId', branchId]}, 
                {$ne: ['$status', 'pending']},
                {
                    $and: [
                        { $eq: [{ $substr: ["$dateGranted", 0, 4] }, year] },
                        { $eq: [{ $substr: ["$dateGranted", 5, 2] }, month] }
                    ]
                }
            ]}} },
            {
                $addFields: {
                    "branchIdObj": { $toObjectId: "$branchId" },
                    "groupIdObj": { $toObjectId: "$groupId" },
                    "clientIdObj": { $toObjectId: "$clientId" }
                }
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchIdObj",
                    foreignField: "_id",
                    as: "branch"
                }
            },
            {
                $lookup: {
                    from: "groups",
                    localField: "groupIdObj",
                    foreignField: "_id",
                    as: "group"
                }
            },
            {
                $unwind: "$group"
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
            { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
        ])
        .toArray();
    } else if (groupId) {
        loans = await db
        .collection('loans')
        .aggregate([
            { $match: {$expr: { $and: [
                {$eq: ['$groupId', groupId]},
                {$ne: ['$status', 'pending']},
                {$eq: ['$occurence', mode]},
                {
                    $and: [
                        { $eq: [{ $substr: ["$dateGranted", 0, 4] }, year] },
                        { $eq: [{ $substr: ["$dateGranted", 5, 2] }, month] }
                    ]
                }
            ]}} },
            {
                $addFields: {
                    "branchIdObj": { $toObjectId: "$branchId" },
                    "groupIdObj": { $toObjectId: "$groupId" },
                    "clientIdObj": { $toObjectId: "$clientId" }
                }
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchIdObj",
                    foreignField: "_id",
                    as: "branch"
                }
            },
            {
                $lookup: {
                    from: "groups",
                    localField: "groupIdObj",
                    foreignField: "_id",
                    as: "group"
                }
            },
            {
                $unwind: "$group"
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
            { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
        ])
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

            loans = await db
                .collection('loans')
                .aggregate([
                    { $match: {$expr: { $and: [
                        { $ne: ['$status', 'pending'] }, 
                        { $in: ['$branchId', branchIds] },
                        {
                            $and: [
                                { $eq: [{ $substr: ["$dateGranted", 0, 4] }, year] },
                                { $eq: [{ $substr: ["$dateGranted", 5, 2] }, month] }
                            ]
                        }
                    ] }} },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" }
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "branchIdObj",
                            foreignField: "_id",
                            as: "branch"
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            as: "group"
                        }
                    },
                    {
                        $unwind: "$group"
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
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
                ])
                .toArray();
        }
    } else {
        loans = await db
            .collection('loans')
            .aggregate([
                { $match: {$expr: { $and: [
                    {$ne: ['$status', 'pending'] }, 
                    {
                        $and: [
                            { $eq: [{ $substr: ["$dateGranted", 0, 4] }, year] },
                            { $eq: [{ $substr: ["$dateGranted", 5, 2] }, month] }
                        ]
                    }
                ] }} },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
    }

    response = {
        success: true,
        loans: loans
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

