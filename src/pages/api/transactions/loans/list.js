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

    const { branchId, groupId, loId, status, currentUserId, mode, currentDate } = req.query;

    if (status) {
        if (loId && branchId) { // lo
            loans = await db
                .collection('loans')
                .aggregate([
                    { $match: { branchId: branchId, status: status, occurence: mode } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loIdObj": { $toObjectId: "$loId" }
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
                            from: "loans",
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: { status: 'active' } },
                                { $project: { 
                                    loanCycle: '$loanCycle'
                                } }
                            ],
                            as: 'pendings'
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $group: { 
                                    _id: '$groupId',
                                    groupStatusArr: { $addToSet: '$groupStatus' } 
                                } }
                            ],
                            as: 'groupStatus'
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $match: { "loanOfficerId": loId } }
                            ],
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
                        $lookup: {
                            from: "users",
                            localField: 'loIdObj',
                            foreignField: '_id',
                            as: 'loanOfficer'
                        }
                    },
                    {
                        $unwind: "$loanOfficer"
                    },
                    {
                        $sort: { "dateAdded": -1 }
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
                ]).toArray();
        } else if (branchId) { // bm
            loans = await db
                .collection('loans')
                .aggregate([
                    { $match: { branchId: branchId, status: status } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loIdObj": { $toObjectId: "$loId" }
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
                            from: "cashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $group: { 
                                    _id: '$groupId',
                                    groupStatusArr: { $addToSet: '$groupStatus' } 
                                } }
                            ],
                            as: 'groupStatus'
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: { status: {$in: ['active', 'completed']} } },
                                { $project: { 
                                    loanCycle: '$loanCycle',
                                    status: '$status'
                                } }
                            ],
                            as: 'pendings'
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
                    {
                        $lookup: {
                            from: "users",
                            localField: 'loIdObj',
                            foreignField: '_id',
                            as: 'loanOfficer'
                        }
                    },
                    {
                        $unwind: "$loanOfficer"
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
                ]).toArray();
        } else if (groupId) {
            loans = await db
                .collection('loans')
                .aggregate([
                    { $match: { groupId: groupId, status: status, occurence: mode } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loIdObj": { $toObjectId: "$loId" }
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
                            from: "cashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $group: { 
                                    _id: '$groupId',
                                    groupStatusArr: { $addToSet: '$groupStatus' } 
                                } }
                            ],
                            as: 'groupStatus'
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
                    {
                        $lookup: {
                            from: "users",
                            localField: 'loIdObj',
                            foreignField: '_id',
                            as: 'loanOfficer'
                        }
                    },
                    {
                        $unwind: "$loanOfficer"
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
                ]).toArray();
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
                            { $match: { $expr: {$and: [{$eq: ['$status', 'pending']}, {$in: ['$branchId', branchIds]}]} } },
                            {
                                $addFields: {
                                    "branchIdObj": { $toObjectId: "$branchId" },
                                    "groupIdObj": { $toObjectId: "$groupId" },
                                    "clientIdObj": { $toObjectId: "$clientId" },
                                    "loIdObj": { $toObjectId: "$loId" }
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
                                    from: "cashCollections",
                                    localField: "groupId",
                                    foreignField: "groupId",
                                    pipeline: [
                                        { $match: { dateAdded: currentDate } },
                                        { $group: { 
                                            _id: '$groupId',
                                            groupStatusArr: { $addToSet: '$groupStatus' } 
                                        } }
                                    ],
                                    as: 'groupStatus'
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
                            {
                                $lookup: {
                                    from: "users",
                                    localField: 'loIdObj',
                                    foreignField: '_id',
                                    as: 'loanOfficer'
                                }
                            },
                            {
                                $unwind: "$loanOfficer"
                            },
                            { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
                        ])
                        .toArray();
            }
        } else {
            loans = await db
                .collection('loans')
                .aggregate([
                    { $match: { status: 'pending' } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loIdObj": { $toObjectId: "$loId" }
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
                            from: "cashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $group: { 
                                    _id: '$groupId',
                                    groupStatusArr: { $addToSet: '$groupStatus' } 
                                } }
                            ],
                            as: 'groupStatus'
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
                    {
                        $lookup: {
                            from: "users",
                            localField: 'loIdObj',
                            foreignField: '_id',
                            as: 'loanOfficer'
                        }
                    },
                    {
                        $unwind: "$loanOfficer"
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
                ])
                .toArray();
        }
    } else {
        if (loId && branchId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { branchId: branchId, occurence: mode } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loIdObj": { $toObjectId: "$loId" }
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
                        from: "cashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $group: { 
                                _id: '$groupId',
                                groupStatusArr: { $addToSet: '$groupStatus' } 
                            } }
                        ],
                        as: 'groupStatus'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { "loanOfficerId": loId } }
                        ],
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
                    $lookup: {
                        from: "users",
                        localField: 'loIdObj',
                        foreignField: '_id',
                        as: 'loanOfficer'
                    }
                },
                {
                    $unwind: "$loanOfficer"
                },
                {
                    $sort: { "dateAdded": -1 }
                },
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
            ])
            .toArray();
        } else if (branchId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { branchId: branchId } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loIdObj": { $toObjectId: "$loId" }
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
                        from: "cashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $group: { 
                                _id: '$groupId',
                                groupStatusArr: { $addToSet: '$groupStatus' } 
                            } }
                        ],
                        as: 'groupStatus'
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
                {
                    $lookup: {
                        from: "users",
                        localField: 'loIdObj',
                        foreignField: '_id',
                        as: 'loanOfficer'
                    }
                },
                {
                    $unwind: "$loanOfficer"
                },
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
            ])
            .toArray();
        } else if (groupId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { groupId: groupId, occurence: mode } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loIdObj": { $toObjectId: "$loId" }
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
                        from: "cashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $group: { 
                                _id: '$groupId',
                                groupStatusArr: { $addToSet: '$groupStatus' } 
                            } }
                        ],
                        as: 'groupStatus'
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
                {
                    $lookup: {
                        from: "users",
                        localField: 'loIdObj',
                        foreignField: '_id',
                        as: 'loanOfficer'
                    }
                },
                {
                    $unwind: "$loanOfficer"
                },
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
            ])
            .toArray();
        } else {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { status: 'pending' } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loIdObj": { $toObjectId: "$loId" }
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
                        from: "cashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $group: { 
                                _id: '$groupId',
                                groupStatusArr: { $addToSet: '$groupStatus' } 
                            } }
                        ],
                        as: 'groupStatus'
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
                {
                    $lookup: {
                        from: "users",
                        localField: 'loIdObj',
                        foreignField: '_id',
                        as: 'loanOfficer'
                    }
                },
                {
                    $unwind: "$loanOfficer"
                },
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loIdObj: 0, password: 0 } }
            ])
            .toArray();
        }
    }

    response = {
        success: true,
        loans: loans
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
