import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const {mode, groupId, branchId, loId, status, branchCodes, currentUserId, currentDate} = req.query;

    let statusCode = 200;
    let response = {};
    let clients;


    if (mode === 'view_offset' && status === 'offset') {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { status: status, branchId: branchId, oldLoId: loId, oldGroupId: groupId } },
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
                { $project: { clientId: 0, loIdObj: 0, groupIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_active_by_group' && groupId) {
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
                        "loIdObj": {$toObjectId: "$loId"},
                        "groupIdObj": {$toObjectId: "$groupId"}
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
                { $project: { clientId: 0, loIdObj: 0, groupIdObj: 0 } }
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
                        "loIdObj": {$toObjectId: "$loId"},
                        "groupIdObj": {$toObjectId: "$groupId"}
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
                { $project: { clientId: 0, loIdObj: 0, groupIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_all_by_branch_codes' && currentUserId) {
        const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
        if (user.length > 0) {
            let branchCodes = [];
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                branchCodes = branches.map(branch => branch.code);
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                branchCodes = branches.map(branch => branch.code);
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                branchCodes = branches.map(branch => branch.code);
            }

            clients = await db
                .collection('branches')
                .aggregate([
                    { $match: { $expr: { $in: ["$code", branchCodes] } } },
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
                                        "loIdObj": {$convert: {input: '$loId', to : 'objectId', onError: '',onNull: ''}},
                                        "groupIdObj": {$convert: {input: '$groupId', to : 'objectId', onError: '',onNull: ''}}
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
                                    $lookup: {
                                        from: "loans",
                                        localField: "clientId",
                                        foreignField: "clientId",
                                        as: "loans"
                                    }
                                },
                                { $project: { clientId: 0, loIdObj: 0, groupIdObj: 0 } }
                            ],
                            as: "clients"
                        }
                    },
                    { $project: { branchIdStr: 0 } }
                ])
                .toArray();
        }
    } else if (mode === 'view_only_no_exist_loan') {
        if (status === 'active') {
            clients = await db
                .collection('loans')
                .aggregate([
                    { $match: {$expr: {$and: [{$eq: ['$status', 'completed']}, {$eq: ['$groupId', groupId]}]} } },
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
                    {
                        $lookup: {
                            from: "loans",
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: { status: 'pending' } }
                            ],
                            as: "loans"
                        }
                    },
                    {
                        "$match": { "loans.0": { "$exists": false } }
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
                                "loIdObj": {$toObjectId: "$loId"},
                                "groupIdObj": {$toObjectId: "$groupId"}
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
                        { $project: { clientId: 0, loIdObj: 0, groupIdObj: 0 } }
                    ])
                    .toArray();
            } else if (branchId) {
                clients = await db
                    .collection('client')
                    .aggregate([
                        { $match: { branchId: branchId, groupId: groupId, status: status } },
                        {
                            $addFields: {
                                "clientId": { $toString: "$_id" },
                                "loIdObj": {$toObjectId: "$loId"},
                                "groupIdObj": {$toObjectId: "$groupId"}
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
                        { $project: { clientId: 0, loIdObj: 0, groupIdObj: 0 } }
                    ])
                    .toArray();
            }
        }
    } else if (mode === 'view_existing_loan') {
            clients = await db
                .collection('loans')
                .aggregate([
                    { $match: {$expr: {$and: [{$eq: ['$status', 'active']}, {$eq: ['$groupId', groupId]}]} } },
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
                                { $match: {status: 'active'} }
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
                            from: "loans",
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: {status: 'pending'} }
                            ],
                            as: "loans"
                        }
                    },
                    {
                        "$match": { "loans.0": { "$exists": false } }
                    },
                    { $project: { clientIdObj: 0, loIdObj: 0 } }
                ])
                .toArray();
        
    } else if (mode === 'view_all_by_group_for_transfer' && groupId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { groupId: groupId } },
                { $addFields: { "clientIdStr": { $toString: "$_id" } } },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientIdStr",
                        foreignField: "clientId",
                        pipeline: [
                            { $match: {$expr: {$or: [{$eq: ['$status', 'pending']}, {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}} }
                        ],
                        as: "loans"
                    }
                }, 
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "clientIdStr",
                        foreignField: "clientId",
                        pipeline: [
                            { $match: { $expr: { $and: [ {$eq: ['$dateAdded', currentDate]}, {$ne: ['$draft', true]} ] } } },
                            { $project: { status: '$status' } }
                        ],
                        as: "cashCollections"
                    }
                }
            ])
            .toArray();
        // clients = await db
        //     .collection('client')
        //     .aggregate([
        //         { $match: { groupId: groupId } },
        //         { $addFields: { "clientIdStr": { $toString: "$_id" } } },
        //         {
        //             $lookup: {
        //                 from: "loans",
        //                 localField: "clientIdStr",
        //                 foreignField: "clientId",
        //                 pipeline: [
        //                     { $match: {$expr: {$or: [{$eq: ['$status', 'pending']}, {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}} }
        //                 ],
        //                 as: "loans"
        //             }
        //         }
        //     ])
        //     .toArray();
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

export const config = {
    api: {
      bodyParser: {
        sizeLimit: '20mb',
      },
    },
}