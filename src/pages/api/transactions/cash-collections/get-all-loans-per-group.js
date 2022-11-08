import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';


export default apiHandler({
    get: getAllLoansPerGroup
});

async function getAllLoansPerGroup(req, res) {
    const { db } = await connectToDatabase();

    const { date, mode, branchId, loId, groupId } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;


    if (branchId) {
        cashCollection = await db
            .collection('groups')
            .aggregate([
                { $match: { branchId: branchId, occurence: mode } },
                {
                    $addFields: {
                        "groupIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {dateAdded: date} },
                            { $group: { 
                                    _id: '$$groupName',
                                    // noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
                                } 
                            }
                        ],
                        as: "cashCollections"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                            { $match: {$expr: { $and: [
                                {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
                            ]}} },
                            { $group: { 
                                    _id: '$$groupName',
                                    activeClients: { $sum: 1 },
                                    activeBorrowers: { $sum: { $cond:{if: { $gt: ['$loanBalance', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: '$mispayments' },
                                    totalRelease: { $sum: '$amountRelease' },
                                    totalLoanBalance: { $sum: '$loanBalance' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { status: 'active', dateGranted: date } },
                            { $group: {
                                    _id: '$$groupName',
                                    currentReleaseAmount: { $sum: '$amountRelease' },
                                    noOfCurrentRelease: { $sum: 1 },
                                    newCurrentRelease: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reCurrentRelease: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "currentRelease"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {$expr: { $and: [
                                {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {eq: ['$fullPaymentDate', date]}
                            ]}} },
                            { $group: {
                                    _id: '$$groupName',
                                    fullPaymentAmount: { $sum: '$history.amountRelease' },
                                    noOfFullPayment: { $sum: 1 },
                                    newFullPayment: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reFullPayment: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "fullPayment"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
            ])
            .toArray();
    } else if (loId) {
        cashCollection = await db
            .collection('groups')
            .aggregate([
                { $match: { loanOfficerId: loId, occurence: mode } },
                {
                    $addFields: {
                        "groupIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {dateAdded: date} },
                            { $unwind: '$collection' },
                            { $project: {
                                'collectionArr': { $sum: { $cond: {if: {$or: [{$eq: ['$collection.status', 'active']}, {$eq: ['$collection.status', 'completed']}]}, then: '$collection.paymentCollection', else: 0} } },
                                'excessArr': { $sum: { $cond: {if: {$ne: ['$collection.status', 'totals']}, then: '$collection.excess', else: 0} } },
                                'totalArr': { $sum: '$collection.total' }
                            } },
                            { $group: { 
                                    _id: '$$groupName',
                                    // noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$collection.mispayment', true] }, then: 1, else: 0} } },
                                    // loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$collectionArr' },
                                    excess: { $sum: '$excessArr' },
                                    total: { $sum: '$totalArr' }
                                } 
                            }
                        ],
                        as: "cashCollections"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                            { $match: {$expr: { $and: [
                                {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
                            ]}} },
                            { $group: { 
                                    _id: '$$groupName',
                                    activeClients: { $sum: 1 },
                                    activeBorrowers: { $sum: { $cond:{if: { $gt: ['$loanBalance', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: '$mispayments' },
                                    totalRelease: { $sum: '$amountRelease' },
                                    totalLoanBalance: { $sum: '$loanBalance' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { status: 'active', dateGranted: date } },
                            { $group: {
                                    _id: '$$groupName',
                                    currentReleaseAmount: { $sum: '$amountRelease' },
                                    noOfCurrentRelease: { $sum: 1 },
                                    newCurrentRelease: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reCurrentRelease: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "currentRelease"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {$expr: { $and: [
                                {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {eq: ['$fullPaymentDate', date]}
                            ]}} },
                            { $group: {
                                    _id: '$$groupName',
                                    fullPaymentAmount: { $sum: '$history.amountRelease' },
                                    noOfFullPayment: { $sum: 1 },
                                    newFullPayment: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reFullPayment: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "fullPayment"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
            ])
            .toArray();
    } else if (groupId) {
        cashCollection = await db
            .collection('groups')
            .aggregate([
                { $match: { groupId: groupId, occurence: mode } },
                {
                    $addFields: {
                        "groupIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {dateAdded: date} },
                            { $group: { 
                                    _id: '$$groupName',
                                    // noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
                                } 
                            }
                        ],
                        as: "cashCollections"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                            { $match: {$expr: { $and: [
                                {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
                            ]}} },
                            { $group: { 
                                    _id: '$$groupName',
                                    activeClients: { $sum: 1 },
                                    activeBorrowers: { $sum: { $cond:{if: { $gt: ['$loanBalance', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: '$mispayments' },
                                    totalRelease: { $sum: '$amountRelease' },
                                    totalLoanBalance: { $sum: '$loanBalance' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { status: 'active', dateGranted: date } },
                            { $group: {
                                    _id: '$$groupName',
                                    currentReleaseAmount: { $sum: '$amountRelease' },
                                    noOfCurrentRelease: { $sum: 1 },
                                    newCurrentRelease: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reCurrentRelease: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "currentRelease"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {$expr: { $and: [
                                {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {eq: ['$fullPaymentDate', date]}
                            ]}} },
                            { $group: {
                                    _id: '$$groupName',
                                    fullPaymentAmount: { $sum: '$history.amountRelease' },
                                    noOfFullPayment: { $sum: 1 },
                                    newFullPayment: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reFullPayment: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "fullPayment"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
            ])
            .toArray();
    } else {
        cashCollection = await db
            .collection('groups')
            .aggregate([
                { $match: { occurence: mode } },
                {
                    $addFields: {
                        "groupIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {dateAdded: date} },
                            { $group: { 
                                    _id: '$$groupName',
                                    // noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
                                } 
                            }
                        ],
                        as: "cashCollections"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                            { $match: {$expr: { $and: [
                                {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
                            ]}} },
                            { $group: { 
                                    _id: '$$groupName',
                                    activeClients: { $sum: 1 },
                                    activeBorrowers: { $sum: { $cond:{if: { $gt: ['$loanBalance', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: '$mispayments' },
                                    totalRelease: { $sum: '$amountRelease' },
                                    totalLoanBalance: { $sum: '$loanBalance' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { status: 'active', dateGranted: date } },
                            { $group: {
                                    _id: '$$groupName',
                                    currentReleaseAmount: { $sum: '$amountRelease' },
                                    noOfCurrentRelease: { $sum: 1 },
                                    newCurrentRelease: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reCurrentRelease: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "currentRelease"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        let: { groupName: '$name' },
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: {$expr: { $and: [
                                {$eq: ['$status', 'completed']}, {$lte: ['$loanBalance', 0]}, {eq: ['$fullPaymentDate', date]}
                            ]}} },
                            { $group: {
                                    _id: '$$groupName',
                                    fullPaymentAmount: { $sum: '$history.amountRelease' },
                                    noOfFullPayment: { $sum: 1 },
                                    newFullPayment: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                    reFullPayment: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                }
                            }
                        ],
                        as: "fullPayment"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
            ])
            .toArray();
    }

        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}