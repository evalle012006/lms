import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';


export default apiHandler({
    get: getLoanWithCashCollection
});

async function getLoanWithCashCollection(req, res) {
    const { db } = await connectToDatabase();

    const { type, date, mode, branchId, loId, groupId } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;

    const cashCollectionDay = await db.collection('cashCollections').find({ dateAdded: date, groupId: groupId }).toArray();

    if (cashCollectionDay.length > 0) {
        cashCollection = cashCollectionDay[0];
    } else {
        if (branchId) {
            cashCollection = await db
                .collection('loans')
                .aggregate([
                    { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                    { $match: {$expr: { $and: [ { $or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}] },
                            {$eq: ['$branchId', branchId]}, {$lte: ['$startDateObj', '$currentDateObj']}
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
                            from: "cashCollections",
                            localField: "loanIdStr",
                            foreignField: "loanId",
                            pipeline: [
                                { $match: { mode: mode } },
                                { $group: { 
                                        _id: '$clientId',
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: '$activeLoan' },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        total: { $sum: '$paymentCollection' }
                                    } 
                                }
                            ],
                            as: "history"
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
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
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
                    {
                        $lookup: {
                            from: "loans",
                            let: { clientId: '$clientId' },
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: {$expr: { $and: [
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}
                                ]}} },
                                { $group: {
                                        _id: '$$clientId',
                                        fullPaymentAmount: { $sum: '$history.amountRelease' },
                                        noOfFullPayment: { $sum: 1 }
                                    }
                                }
                            ],
                            as: "fullPaymentTotal"
                        }
                    },
                    { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
                ])
                .toArray();
        } else if (loId) {
            cashCollection = await db
                .collection('loans')
                .aggregate([
                    { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                    { $match: {$expr: { $and: [ { $or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}] },
                            {$lte: ['$startDateObj', '$currentDateObj']}
                    ]}} },
                    // { $match: { status: 'active' } },
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
                                { $match: { loId: loId, dateAdded: date } }
                            ],
                            as: "current"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            localField: "loanIdStr",
                            foreignField: "loanId",
                            pipeline: [
                                { $match: { loId: loId, mode: mode } },
                                { $group: { 
                                        _id: '$clientId',
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: '$activeLoan' },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        total: { $sum: '$paymentCollection' }
                                    } 
                                }
                            ],
                            as: "history"
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
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
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
                    {
                        $lookup: {
                            from: "loans",
                            let: { clientId: '$clientId' },
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: {$expr: { $and: [
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}
                                ]}} },
                                { $group: {
                                        _id: '$$clientId',
                                        fullPaymentAmount: { $sum: '$history.amountRelease' },
                                        noOfFullPayment: { $sum: 1 }
                                    }
                                }
                            ],
                            as: "fullPaymentTotal"
                        }
                    },
                    { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
                ])
                .toArray();
        } else if (groupId) {
            cashCollection = await db
                .collection('loans')
                .aggregate([
                    { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                    // { $match: { groupId: groupId, status: 'active',  } },
                    { $match: {$expr: { $and: [
                        {$eq: ['$groupId', groupId]}, {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
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
                            from: "cashCollections",
                            localField: "loanIdStr",
                            foreignField: "loanId",
                            pipeline: [
                                { $match: { mode: mode } },
                                { $group: { 
                                        _id: '$clientId',
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: '$activeLoan' },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        total: { $sum: '$paymentCollection' }
                                    } 
                                }
                            ],
                            as: "history"
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
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
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
                    {
                        $lookup: {
                            from: "loans",
                            let: { clientId: '$clientId' },
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: {$expr: { $and: [
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}
                                ]}} },
                                { $group: {
                                        _id: '$$clientId',
                                        fullPaymentAmount: { $sum: '$history.amountRelease' },
                                        noOfFullPayment: { $sum: 1 }
                                    }
                                }
                            ],
                            as: "fullPaymentTotal"
                        }
                    },
                    { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
                ])
                .toArray();
        } else {
            cashCollection = await db
                .collection('loans')
                .aggregate([
                    { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                    { $match: {$expr: { $and: [ { $or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}] },
                            {$lte: ['$startDateObj', '$currentDateObj']}
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
                            from: "cashCollections",
                            localField: "loanIdStr",
                            foreignField: "loanId",
                            pipeline: [
                                { $match: { mode: mode } },
                                { $group: { 
                                        _id: '$clientId',
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: '$activeLoan' },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        total: { $sum: '$paymentCollection' }
                                    } 
                                }
                            ],
                            as: "history"
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
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
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
                    {
                        $lookup: {
                            from: "loans",
                            let: { clientId: '$clientId' },
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: {$expr: { $and: [
                                    {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}
                                ]}} },
                                { $group: {
                                        _id: '$$clientId',
                                        fullPaymentAmount: { $sum: '$history.amountRelease' },
                                        noOfFullPayment: { $sum: 1 }
                                    }
                                }
                            ],
                            as: "fullPaymentTotal"
                        }
                    },
                    { $project: { clientIdObj: 0, loanIdStr: 0, startDateObj: 0, groupIdObj: 0 } }
                ])
                .toArray();
        }
    }

        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}