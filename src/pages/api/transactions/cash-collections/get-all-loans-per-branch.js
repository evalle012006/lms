import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getAllLoansPerGroup
});

async function getAllLoansPerGroup(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const { date, mode, areaManagerId } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;
    
    if (areaManagerId) {
        const areaManager = await db.collection("users").find({ _id: ObjectId(areaManagerId) }).toArray();
        if (areaManager.length > 0) {
            const branchCodes = areaManager[0].designatedBranch;

            cashCollection = await db
                .collection('branches')
                .aggregate([
                    {
                        $match: { $expr: {$in: ['$code', branchCodes]} }
                    },
                    {
                        $addFields: {
                            "branchIdstr": { $toString: "$_id" }
                        }
                    },
                    {
                        $lookup: {
                            from: "groupCashCollections",
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: { dateAdded: date } },
                                { 
                                    $group: {
                                        _id: '$branchId',
                                        groupSummaryIds: { $addToSet: { _id: '$_id', groupId: '$groupId', status: '$status' } },
                                        statusArr: { $addToSet: '$status' },
                                    }
                                }
                            ],
                            as: 'groupCashCollections'
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: { dateAdded: date} },
                                { $group: { 
                                        _id: '$branchId',
                                        // noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: {
                                            $cond: {
                                                if: { $or: [{$eq: ['$remarks.value', 'delinquent']}, {$eq: ['$remarks.value', 'excused']}, {$eq: ['$remarks.value', 'past due']}] },
                                                then: '$activeLoan',
                                                else: 0
                                            }
                                        } },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        pastDue: { $sum: '$pastDue' },
                                        noPastDue: { $sum: {$cond: { if: { $eq: ['$remarks.value', 'past due'] }, then: 1, else: 0 } }},
                                        total: { $sum: '$total' }
                                    } 
                                }
                            ],
                            as: "cashCollections"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: { status: { $ne: 'closed' },  dateAdded: date } },
                                { $group: { 
                                        _id: '$branchId',
                                        activeClients: { $sum: 1 },
                                        activeBorrowers: { $sum: { $cond:{if: { $gt: ['$loanBalance', 0] }, then: 1, else: 0} } }
                                    } 
                                }
                            ],
                            as: "activeLoans"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                                { $match: {$expr:  {$and: [{$ne: ['$status', 'reject']}, {$lte: ['$startDateObj', '$currentDateObj']}]} } },
                                { $group: { 
                                        _id: '$branchId',
                                        mispayment: { $sum: { $cond:{
                                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] }, 
                                            then: '$mispayment',
                                            else: {
                                                    $cond: {
                                                        if: { $and: [{$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}] },
                                                        then: '$mispayment',
                                                        else: 0
                                                    }
                                                }
                                        } } },
                                        totalRelease: { $sum: { $cond:{
                                                if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] }, 
                                                then: '$amountRelease', 
                                                else: 0
                                        } } },
                                        totalLoanBalance: { $sum: { $cond:{
                                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] }, 
                                            then: '$loanBalance', 
                                            else: 0
                                        } } },
                                        loanTarget: { 
                                            $sum: { 
                                                $cond: {
                                                    if: { $ne: ['$status', 'pending']}, 
                                                    then: { 
                                                        $cond: {
                                                            if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}] },
                                                            then: '$history.activeLoan',
                                                            else: '$activeLoan'
                                                        } 
                                                    }, 
                                                    else: 0
                                                } 
                                            }
                                        },
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
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: { status: 'active', dateGranted: date } },
                                { $group: {
                                        _id: '$branchId',
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
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: {$expr: { $and: [
                                    {$or: [{$eq: ['$status', 'completed']}, {$eq: ['$status', 'closed']}]}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
                                ]}} },
                                { $group: {
                                        _id: '$branchId',
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
                    {
                        $sort: { code: 1 }
                    }
                ]).toArray();
        }
    } else {
        cashCollection = await db
            .collection('branches')
            .aggregate([
                {
                    $addFields: {
                        "branchIdstr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "branchIdstr",
                        foreignField: "branchId",
                        pipeline: [
                            { $match: { dateAdded: date } },
                            { 
                                $group: {
                                    _id: '$branchId',
                                    groupSummaryIds: { $addToSet: { _id: '$_id', groupId: '$groupId', status: '$status' } },
                                    statusArr: { $addToSet: '$status' },
                                }
                            }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "branchIdstr",
                        foreignField: "branchId",
                        pipeline: [
                            { $match: { dateAdded: date} },
                            { $group: { 
                                    _id: '$branchId',
                                    // noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: {
                                        $cond: {
                                            if: { $or: [{$eq: ['$remarks.value', 'delinquent']}, {$eq: ['$remarks.value', 'excused']}, {$eq: ['$remarks.value', 'past due']}] },
                                            then: '$activeLoan',
                                            else: 0
                                        }
                                    } },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    pastDue: { $sum: '$pastDue' },
                                    noPastDue: { $sum: {$cond: { if: { $eq: ['$remarks.value', 'past due'] }, then: 1, else: 0 } }},
                                    total: { $sum: '$total' }
                                } 
                            }
                        ],
                        as: "cashCollections"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "branchIdstr",
                        foreignField: "branchId",
                        pipeline: [
                            { $match: { status: { $ne: 'closed' } } },
                            { $group: { 
                                    _id: '$branchId',
                                    activeClients: { $sum: 1 },
                                    activeBorrowers: { $sum: { $cond:{if: { $gt: ['$loanBalance', 0] }, then: 1, else: 0} } }
                                } 
                            }
                        ],
                        as: "activeLoans"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "branchIdstr",
                        foreignField: "branchId",
                        pipeline: [
                            { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                            { $match: {$expr:  {$and: [{$ne: ['$status', 'reject']}, {$lte: ['$startDateObj', '$currentDateObj']}]} } },
                            { $group: { 
                                    _id: '$branchId',
                                    mispayment: { $sum: { $cond:{
                                        if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] }, 
                                        then: '$mispayment',
                                        else: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}] },
                                                    then: '$mispayment',
                                                    else: 0
                                                }
                                            }
                                    } } },
                                    totalRelease: { $sum: { $cond:{
                                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] }, 
                                            then: '$amountRelease', 
                                            else: 0
                                    } } },
                                    totalLoanBalance: { $sum: { $cond:{
                                        if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] }, 
                                        then: '$loanBalance', 
                                        else: 0
                                    } } },
                                    loanTarget: { 
                                        $sum: { 
                                            $cond: {
                                                if: { $ne: ['$status', 'pending']}, 
                                                then: { 
                                                    $cond: {
                                                        if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}] },
                                                        then: '$history.activeLoan',
                                                        else: '$activeLoan'
                                                    } 
                                                }, 
                                                else: 0
                                            } 
                                        }
                                    },
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
                        localField: "branchIdstr",
                        foreignField: "branchId",
                        pipeline: [
                            { $match: { status: 'active', dateGranted: date } },
                            { $group: {
                                    _id: '$branchId',
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
                        localField: "branchIdstr",
                        foreignField: "branchId",
                        pipeline: [
                            { $match: {$expr: { $and: [
                                {$or: [{$eq: ['$status', 'completed']}, {$eq: ['$status', 'closed']}]}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
                            ]}} },
                            { $group: {
                                    _id: '$branchId',
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
                {
                    $sort: { code: 1 }
                }
            ])
            .toArray();
    }
    
        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}