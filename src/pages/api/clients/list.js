import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const {mode, groupId, branchId, loId, status, branchCodes} = req.query;

    let statusCode = 200;
    let response = {};
    let clients;


    if (mode === 'view_active_by_group' && groupId) {
        clients = await db
            .collection('loans')
            .aggregate([
                { $match: { "groupId": groupId, 'status': 'active' } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "groupIdObj": { $toObjectId: "$groupId" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { "status": "active" } }
                        ],
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
                },
                {
                    $addFields: {
                        "loIdObj": {$toObjectId: "$client.loId"}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loIdObj",
                        foreignField: "_id",
                        as: "lo"
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                            pipeline: [
                                { $match: { "status": "active" } }
                            ],
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
                },
                { $project: { groupIdObj: 0, clientIdObj: 0, loIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_by_group' && groupId) {
        clients = await db
            .collection('loans')
            .aggregate([
                // { $match: { "groupId": groupId } },
                { $match: {$expr: { $and: [
                    {$or: [{$eq: ['$status', 'completed']}, {$eq: ['$status', 'active']}, {$eq: ['$status', 'pending']}]}, {$eq: ['$groupId', groupId]}
                ]}} },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "groupIdObj": { $toObjectId: "$groupId" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { "status": "active" } }
                        ],
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
                }, 
                {
                    $addFields: {
                        "loIdObj": {$toObjectId: "$client.loId"}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loIdObj",
                        foreignField: "_id",
                        as: "lo"
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
                { $project: { groupIdObj: 0, clientIdObj: 0, loIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_by_lo' && loId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { loId: loId, status: status } },
                {
                    $addFields: {
                        "clientId": { $toString: "$_id" },
                        "loIdObj": {$toObjectId: "$loId"}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loIdObj",
                        foreignField: "_id",
                        as: "lo"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        // pipeline: [
                        //     { $match: { "status": "active" } }
                        // ],
                        as: "loans"
                    }
                },
                { $project: { clientId: 0, loIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_all_by_branch' && branchId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { branchId: branchId, status: status } },
                {
                    $addFields: {
                        "clientId": { $toString: "$_id" },
                        "loIdObj": {$toObjectId: "$loId"}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loIdObj",
                        foreignField: "_id",
                        as: "lo"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        // pipeline: [
                        //     { $match: { "status": "active" } }
                        // ],
                        as: "loans"
                    }
                },
                { $project: { clientId: 0, loIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_all_by_branch_codes' && branchCodes) {
        const codes = branchCodes.trim().split(",");
        clients = await db
            .collection('branches')
            .aggregate([
                // { $match: { $expr: { $and: [{$eq: ["$status", status]}, {$in: ["$code", codes]}] } } },
                { $match: { $expr: { $in: ["$code", codes] } } },
                {
                    $addFields: {
                        "branchIdStr": {$toString: "$_id"}
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "branchIdStr",
                        foreignField: "branchId",
                        pipeline: [
                            { $match: { status: status } },
                            {
                                $addFields: {
                                    "clientId": { $toString: "$_id" },
                                    "loIdObj": {$toObjectId: "$loId"}
                                }
                            },
                            {
                                $lookup: {
                                    from: "users",
                                    localField: "loIdObj",
                                    foreignField: "_id",
                                    as: "lo"
                                }
                            },
                            {
                                $lookup: {
                                    from: "loans",
                                    localField: "clientId",
                                    foreignField: "clientId",
                                    as: "loans"
                                }
                            },
                            { $project: { clientId: 0, loIdObj: 0 } }
                        ],
                        as: "clients"
                    }
                },
                { $project: { branchIdStr: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_only_no_exist_loan') {
        if (status === 'active') {
            clients = await db
                .collection('loans')
                .aggregate([
                    { $match: {$expr: {$and: [{$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$eq: ['$groupId', groupId]}]} } },
                    {
                        $addFields: {
                            "clientIdObj": { $toObjectId: "$clientId" }
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $match: {status: status} }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $unwind: "$client"
                    },
                    {
                        $addFields: {
                            "loIdObj": {$toObjectId: "$client.loId"}
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "loIdObj",
                            foreignField: "_id",
                            as: "lo"
                        }
                    },
                    { $project: { clientIdObj: 0, loIdObj: 0 } }
                ])
                .toArray();
        } else {
            if (loId) {
                clients = await db
                    .collection('client')
                    .aggregate([
                        { $match: { loId: loId, groupId: groupId, status: status } },
                        {
                            $addFields: {
                                "clientId": { $toString: "$_id" },
                                "loIdObj": {$toObjectId: "$loId"}
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "loIdObj",
                                foreignField: "_id",
                                as: "lo"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "clientId",
                                foreignField: "clientId",
                                pipeline: [
                                    { $match: {$expr: {$or: [{$eq: ['$status', 'pending']}, {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}} }
                                ],
                                as: "loans"
                            }
                        },
                        {
                            "$match": { "loans.0": { "$exists": false } }
                        },
                        { $project: { clientId: 0, loIdObj: 0 } }
                    ])
                    .toArray();
            } else if (branchId) {
                clients = await db
                    .collection('client')
                    .aggregate([
                        { $match: { branchId: branchId, status: status } },
                        {
                            $addFields: {
                                "clientId": { $toString: "$_id" },
                                "loIdObj": {$toObjectId: "$loId"}
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "loIdObj",
                                foreignField: "_id",
                                as: "lo"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "clientId",
                                foreignField: "clientId",
                                pipeline: [
                                    { $match: {$expr: {$or: [{$eq: ['$status', 'pending']}, {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}} }
                                ],
                                as: "loans"
                            }
                        },
                        {
                            "$match": { "loans.0": { "$exists": false } }
                        },
                        { $project: { clientId: 0, loIdObj: 0 } }
                    ])
                    .toArray();
            }
        }
    } else {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { status: status } },
                {
                    $addFields: {
                        "clientId": { $toString: "$_id" },
                        "loIdObj": {$toObjectId: "$loId"}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loIdObj",
                        foreignField: "_id",
                        as: "lo"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        as: "loans"
                    }
                },
                { $project: { clientId: 0, loIdObj: 0 } }
            ])
            .toArray();
    }
    
    response = {
        success: true,
        clients: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
