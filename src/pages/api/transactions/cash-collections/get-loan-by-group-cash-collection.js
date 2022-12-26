import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';


export default apiHandler({
    get: getLoanWithCashCollection
});

async function getLoanWithCashCollection(req, res) {
    const { db } = await connectToDatabase();

    const { date, type, groupId } = req.query;
    const currentDate = moment(new Date()).format('YYYY-MM-DD');
    let statusCode = 200;
    let response = {};
    let cashCollection;

    let groupCashCollectionDay = await db.collection('groupCashCollections').find({ dateAdded: date, groupId: groupId }).toArray();
    // need to check if has cashCollections then merged!!! note that the pending and tomorrow is already save in cash collections
    if (groupCashCollectionDay.length > 0) {
        groupCashCollectionDay = groupCashCollectionDay[0];
            let cashCollectionDay = [];
            let tomorrowPending = [];
        // if (groupCashCollectionDay.status === 'pending') {
            if (type === 'current') {
                cashCollectionDay = await db
                    .collection('loans')
                    .aggregate([
                        { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                        { $match: {$expr: { $and: [
                            {$eq: ['$groupId', groupId]}, {$or: [ {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}, {$eq: ['$status', 'closed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
                        ]}} },
                        {
                            $addFields: {
                                "clientIdObj": { $toObjectId: "$clientId" },
                                "loanIdStr": { $toString: "$_id" },
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
                                from: "cashCollections",
                                localField: "loanIdStr",
                                foreignField: "loanId",
                                pipeline: [
                                    { $match: { dateAdded: date } }
                                ],
                                as: "current"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                let: { clientId: '$clientId' },
                                localField: "clientId",
                                foreignField: "clientId",
                                pipeline: [
                                    { $match: { status: 'active', dateAdded: date } },
                                    { $group: {
                                            _id: '$$clientId',
                                            currentReleaseAmount: { $sum: '$amountRelease' },
                                            noOfCurrentRelease: { $sum: 1 }
                                        }
                                    }
                                ],
                                as: "currentRelease"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                let: { clientId: '$clientId' },
                                localField: "clientId",
                                foreignField: "clientId",
                                pipeline: [
                                    { $match: {$expr: { $and: [
                                        {$or: [{$eq: ['$status', 'completed']}, {$eq: ['$status', 'closed']}]}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
                                    ]}} },
                                    { $group: {
                                            _id: '$$clientId',
                                            fullPaymentAmount: { $sum: '$history.amountRelease' },
                                            noOfFullPayment: { $sum: 1 }
                                        }
                                    }
                                ],
                                as: "fullPayment"
                            }
                        },
                        { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
                    ])
                    .toArray();

                // if (groupCashCollectionDay.status === 'pending' || cashCollectionDay.length === 0) {
                    tomorrowPending = await db
                        .collection('loans')
                        .aggregate([
                            { $match: {$expr: { $and: [
                                {$or: [{$eq: ['$dateGranted', date]}, {$eq: ['$status', 'pending']}]}, {$eq: ['$groupId', groupId]}
                            ]}} },
                            {
                                $addFields: {
                                    "loanIdStr": { $toString: "$_id" },
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
                                    from: "cashCollections",
                                    localField: "loanIdStr",
                                    foreignField: "loanId",
                                    pipeline: [
                                        { $match: { dateAdded: date } }
                                    ],
                                    as: "current"
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
                            { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
                        ])
                        .toArray();
                // }
            } else if (type === 'filter') {
                cashCollectionDay = await db
                    .collection('cashCollections')
                    .aggregate([
                        { $match: {dateAdded: date, groupId: groupId} },
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
                                from: "loans",
                                let: { clientId: '$clientId' },
                                localField: "clientId",
                                foreignField: "clientId",
                                pipeline: [
                                    { $match: { status: 'active', dateAdded: date } },
                                    { $group: {
                                            _id: '$$clientId',
                                            currentReleaseAmount: { $sum: '$amountRelease' },
                                            noOfCurrentRelease: { $sum: 1 }
                                        }
                                    }
                                ],
                                as: "currentRelease"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                let: { clientId: '$clientId' },
                                localField: "clientId",
                                foreignField: "clientId",
                                pipeline: [
                                    { $match: {$expr: { $and: [
                                        {$or: [{$eq: ['$status', 'completed']}, {$eq: ['$status', 'closed']}]}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
                                    ]}} },
                                    { $group: {
                                            _id: '$$clientId',
                                            fullPaymentAmount: { $sum: '$history.amountRelease' },
                                            noOfFullPayment: { $sum: 1 }
                                        }
                                    }
                                ],
                                as: "fullPayment"
                            }
                        },
                        { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
                    ])
                    .toArray();
            }

            cashCollection = {
                groupSummary: groupCashCollectionDay,
                collection: cashCollectionDay,
                tomorrowPending: tomorrowPending
            };
        // } else {
        //     let cashCollectionDay = await db.collection('cashCollections')
        //         .aggregate([
        //             { $match: { groupCollectionId: groupCashCollectionDay._id + '' } },
        //             {
        //                 $addFields: { 
        //                     "loanIdObj": { $toObjectId: "$loanId" },
        //                     "clientIdObj": { $toObjectId: "$clientId" }
        //                 }
        //             },
        //             {
        //                 $lookup: {
        //                     from: "loans",
        //                     localField: "loanIdObj",
        //                     foreignField: "_id",
        //                     as: "loan"
        //                 }
        //             },
        //             { $unwind: "$loan" },
        //             {
        //                 $lookup: {
        //                     from: "client",
        //                     localField: "clientIdObj",
        //                     foreignField: "_id",
        //                     as: "client"
        //                 }
        //             },
        //             { $unwind: "$client" },
        //             { $project: { loanIdObj: 0, clientIdObj: 0 } }
        //         ])
        //         .toArray();

        //     if (cashCollectionDay.length > 0) {
        //         cashCollection = {
        //             groupSummary: groupCashCollectionDay,
        //             collection: cashCollectionDay,
        //             flag: 'existing'
        //         };
        //     } else {
        //         cashCollectionDay = await db
        //             .collection('loans')
        //             .aggregate([
        //                 { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
        //                 { $match: {$expr: { $and: [
        //                     {$eq: ['$groupId', groupId]}, {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
        //                 ]}} },
        //                 {
        //                     $addFields: {
        //                         "clientIdObj": { $toObjectId: "$clientId" },
        //                         "loanIdStr": { $toString: "$_id" },
        //                         "groupIdObj": { $toObjectId: "$groupId" }
        //                     }
        //                 },
        //                 {
        //                     $lookup: {
        //                         from: "client",
        //                         localField: "clientIdObj",
        //                         foreignField: "_id",
        //                         as: "client"
        //                     }
        //                 },
        //                 {
        //                     $unwind: "$client"
        //                 },
        //                 {
        //                     $lookup: {
        //                         from: "groups",
        //                         localField: "groupIdObj",
        //                         foreignField: "_id",
        //                         as: "group"
        //                     }
        //                 },
        //                 {
        //                     $unwind: "$group"
        //                 },
        //                 {
        //                     $lookup: {
        //                         from: "cashCollections",
        //                         localField: "loanIdStr",
        //                         foreignField: "loanId",
        //                         pipeline: [
        //                             { $match: { dateAdded: date } }
        //                         ],
        //                         as: "current"
        //                     }
        //                 },
        //                 // {
        //                 //     $lookup: {
        //                 //         from: "cashCollections",
        //                 //         localField: "loanIdStr",
        //                 //         foreignField: "loanId",
        //                 //         pipeline: [
        //                 //             { $match: { mode: mode } },
        //                 //             { $project: {
        //                 //                 'collectionArr': { $sum: { $cond: {if: {$or: [{$eq: ['$collection.status', 'active']}, {$eq: ['$collection.status', 'completed']}, {$eq: ['$collection.status', 'closed']}]}, then: '$collection.paymentCollection', else: 0} } },
        //                 //                 'excessArr': { $sum: { $cond: {if: {$ne: ['$collection.status', 'totals']}, then: '$collection.excess', else: 0} } },
        //                 //                 'totalArr': { $sum: '$collection.total' },
        //                 //                 'activeLoanArr': { $sum: '$collection.activeLoan' },
        //                 //                 'mispaymentArr' : { $sum: { $cond:{if: { $eq: ['$collection.mispayment', true] }, then: 1, else: 0} } }
        //                 //             } },
        //                 //             { $group: { 
        //                 //                     _id: '$clientId',
        //                 //                     mispayment: { $sum: 'mispaymentArr' },
        //                 //                     loanTarget: { $sum: '$activeLoanArr' },
        //                 //                     collection: { $sum: '$collectionArr' },
        //                 //                     excess: { $sum: '$excessArr' },
        //                 //                     total: { $sum: '$totalArr' }
        //                 //                 } 
        //                 //             }
        //                 //         ],
        //                 //         as: "totals"
        //                 //     }
        //                 // },
        //                 // {
        //                 //     $lookup: {
        //                 //         from: "cashCollections",
        //                 //         localField: "groupId",
        //                 //         foreignField: "groupId",
        //                 //         pipeline: [
        //                 //             { $match: { $expr: {$and: [
        //                 //                 {$eq: [ {$getField: {field: {$literal: '$loanId'}, input: 'collection'}}, '$loanIdStr' ]}, 
        //                 //                 {$eq: [ {$getField: {field: {$literal: '$clientId'}, input: 'collection'}}, '$clientId' ]}
        //                 //             ]} } },
        //                 //             {
        //                 //                 $project: {
        //                 //                     collection: {$filter: {
        //                 //                         input: '$collection',
        //                 //                         as: 'collection',
        //                 //                         cond: {$and: [{$ne: ['$$collection.clientId', '$clientId']}, {$ne: ['$$collection.status', 'open']}]}
        //                 //                     }}
        //                 //                 }
        //                 //             }
        //                 //         ],
        //                 //         as: "collections"
        //                 //     }
        //                 // },
        //                 {
        //                     $lookup: {
        //                         from: "loans",
        //                         let: { clientId: '$clientId' },
        //                         localField: "clientId",
        //                         foreignField: "clientId",
        //                         pipeline: [
        //                             { $match: { status: 'active', dateAdded: date } },
        //                             { $group: {
        //                                     _id: '$$clientId',
        //                                     currentReleaseAmount: { $sum: '$amountRelease' },
        //                                     noOfCurrentRelease: { $sum: 1 }
        //                                 }
        //                             }
        //                         ],
        //                         as: "currentRelease"
        //                     }
        //                 },
        //                 {
        //                     $lookup: {
        //                         from: "loans",
        //                         let: { clientId: '$clientId' },
        //                         localField: "clientId",
        //                         foreignField: "clientId",
        //                         pipeline: [
        //                             { $match: {$expr: { $and: [
        //                                 {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
        //                             ]}} },
        //                             { $group: {
        //                                     _id: '$$clientId',
        //                                     fullPaymentAmount: { $sum: '$history.amountRelease' },
        //                                     noOfFullPayment: { $sum: 1 }
        //                                 }
        //                             }
        //                         ],
        //                         as: "fullPayment"
        //                     }
        //                 },
        //                 { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
        //             ])
        //             .toArray();

        //         cashCollection = {
        //             groupSummary: groupCashCollectionDay,
        //             collection: cashCollectionDay,
        //             flag: 'new'
        //         };
        //     }
        // }

        response = { success: true, data: cashCollection };
    } else {
        response = { error: true, message: 'Group Collection Summary not found!' };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}