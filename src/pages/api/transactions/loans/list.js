import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

// const currentDate = moment(new Date()).format('YYYY-MM-DD');


export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};
    let loans;

    const { branchId, groupId, loId, status, areaManagerId, mode, currentDate } = req.query;

    if (status) {
        if (loId && branchId) {
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
                            from: "groupCashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                            ],
                            as: 'groupCashCollections'
                        }
                    },
                    {
                        $unwind: "$groupCashCollections"
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
        } else if (branchId) {
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
                        $lookup: {
                            from: "groupCashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                            ],
                            as: 'groupCashCollections'
                        }
                    },
                    {
                        $unwind: "$groupCashCollections"
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
                            from: "groupCashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                            ],
                            as: 'groupCashCollections'
                        }
                    },
                    {
                        $unwind: "$groupCashCollections"
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
        } else if (areaManagerId) {
            const areaManager = await db.collection("users").find({ _id: ObjectId(areaManagerId) }).toArray();
            if (areaManager.length > 0) {
                const branchCodes = areaManager[0].designatedBranch;
                const branches = await db.collection("branches").find({ $expr: { $in: ['$code', branchCodes] } }).toArray();
                if (branches.length > 0) {
                    const branchIds = branches.map(b => b._id + '');
                    loans = await db
                        .collection('loans')
                        .aggregate([
                            { $match: { $expr: {$and: [{$eq: ['$status', 'pending']}, {$in: ['$branchId', branchIds]}, {$eq: ['$occurence', mode]}]} } },
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
                                    from: "groupCashCollections",
                                    localField: "groupId",
                                    foreignField: "groupId",
                                    pipeline: [
                                        { $match: { dateAdded: currentDate } },
                                        { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                                    ],
                                    as: 'groupCashCollections'
                                }
                            },
                            {
                                $unwind: "$groupCashCollections"
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
        } else {
            loans = await db
                .collection('loans')
                .aggregate([
                    { $match: { status: 'pending', occurence: mode } },
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
                            from: "groupCashCollections",
                            localField: "groupId",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: currentDate } },
                                { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                            ],
                            as: 'groupCashCollections'
                        }
                    },
                    {
                        $unwind: "$groupCashCollections"
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
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
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
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
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
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
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
                { $match: { status: 'pending', occurence: mode } },
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
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
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
