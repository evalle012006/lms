import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';


export default apiHandler({
    get: getLoanWithCashCollection
});

async function getLoanWithCashCollection(req, res) {
    const { db } = await connectToDatabase();

    const { date, type, groupId } = req.query;

    let statusCode = 200;
    let response = {};
    let cashCollection;

    let cashCollectionDay = [];
    let tomorrowPending = [];

    if (type === 'current') {
        cashCollectionDay = await db
            .collection('loans')
            .aggregate([
                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                { $match: {
                    $expr: { 
                        $and: [
                            {$eq: ['$groupId', groupId]},
                            {$or: [
                                {$gte: ['$currentDateObj', '$startDateObj']},
                                {$eq: ['$transfer', true]}
                            ]},
                            {$or: [ 
                                {$eq: ['$status', 'active']},
                                {$eq: ['$status', 'completed']},
                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}] },
                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$closedDate', date]}] },
                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$transferred', true]}, {$eq: ['$endDate', date]}] }
                            ]}
                        ]
                    }
                } },
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
                { $sort: { slotNo: 1 } },
                { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
            ])
            .toArray();

        tomorrowPending = await db
            .collection('loans')
            .aggregate([
                { $match: {$expr: { $and: [
                    {$ne: ['$status', 'closed']}, {$ne: ['$status', 'reject']}, {$ne: ['$status', 'completed']}, 
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
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        pipeline: [
                            { $match: { status: 'closed' } }
                        ],
                        as: "prevLoans"
                    }
                },
                { $sort: { slotNo: 1 } },
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
    } else if (type === 'filter') {
        cashCollectionDay = await db
            .collection('cashCollections')
            .aggregate([
                { $match: { dateAdded: date, groupId: groupId } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "loanIdObj": { $toObjectId: "$loanId" }
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
                        localField: "loanIdObj",
                        foreignField: "_id",
                        as: "loans"
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
                { $sort: { slotNo: 1 } },
                { $project: { clientIdObj: 0, loanIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
            ])
            .toArray();
    }

    cashCollection = {
        collection: cashCollectionDay,
        tomorrowPending: tomorrowPending
    };

    response = { success: true, data: cashCollection };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}