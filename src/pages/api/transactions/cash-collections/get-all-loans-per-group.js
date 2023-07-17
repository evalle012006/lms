import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: getAllLoansPerGroup
});

async function getAllLoansPerGroup(req, res) {
    const { db } = await connectToDatabase();

    const { date, mode, branchCode, loId, dayName, currentDate } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;

    const currentDay = moment(date).format('dddd').toLowerCase();

    if (currentDate === date) {
        if (branchCode) {
            cashCollection = await db
                .collection('users')
                .aggregate([
                    { $match: { designatedBranch: branchCode, "role.rep": 4 } },
                    {
                        $addFields: {
                            "loIdStr": { $toString: "$_id" }
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "loIdStr",
                            foreignField: "loanOfficerId",
                            pipeline: [
                                { $match: { day: currentDay } },
                                {
                                    $addFields: {
                                        "groupIdStr": { $toString: "$_id" }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: "loans",
                                        localField: "groupIdStr",
                                        foreignField: 'groupId',
                                        pipeline: [
                                            { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                                            {
                                                $group: {
                                                    _id: '$groupId',
                                                    loanTarget: { 
                                                        $sum: { 
                                                            $cond: {
                                                                if: {$and: [{ $ne: ['$status', 'pending']}, {$lte: ['$startDateObj', '$currentDateObj']} ]}, 
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
                                                    mcbu: { $sum: '$mcbu' }
                                                }
                                            }
                                        ],
                                        as: "loanTarget"
                                    }
                                }
                            ],
                            as: 'groups'
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transfer: true, dateAdded: date, occurence: 'daily' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferDailyReceivedDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transferred: true, dateAdded: date, occurence: 'daily' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferDailyGiverDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transfer: true, dateAdded: date, occurence: 'weekly' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferWeeklyReceivedDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transferred: true, dateAdded: date, occurence: 'weekly' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferWeeklyGiverDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { $expr: { $and: [
                                    { $eq: ['$dateAdded', date] },
                                    { $or: [
                                        { $ifNull: ['$draft', 'Unspecified'] },
                                        { $eq: ['$draft', false] }
                                    ] }
                                ] } } },
                                { $group: { 
                                        _id: '$loId',
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: {
                                            $cond: {
                                                if: { $or: [
                                                    {$eq: ['$remarks.value', 'delinquent']},
                                                    {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                ] },
                                                then: '$prevData.activeLoan',
                                                else: 0
                                            }
                                        } },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        total: { $sum: '$total' },
                                        offsetPerson: { $sum: {
                                            $cond: {
                                                if: {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        mcbu: { $sum: '$mcbu' },
                                        mcbuTarget: { $sum: {
                                            $cond: {
                                                if: { $and: [{$eq: ['$occurence', 'weekly']}, {$eq: ['$groupDay', currentDay]}] },
                                                then: {
                                                    $cond: {
                                                        if: { $or: [
                                                            {$eq: ['$remarks.value', 'delinquent']},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                        ] },
                                                        then: 0,
                                                        else: 50
                                                    }
                                                },
                                                else: 0
                                            }
                                        } },
                                        mcbuCol: { $sum: '$mcbuCol' },
                                        mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                        mcbuReturnNo: { $sum: {
                                            $cond: {
                                                if: { $or: [
                                                    {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                    {$gt: ['$mcbuReturnAmt', 0]}
                                                ] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                        mcbuInterest: { $sum: '$mcbuInterest' },
                                        transfer: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferMCBU: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$mcbu',
                                                else: 0
                                            }
                                        } },
                                        transferAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        transferred: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferredAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferredLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        groupStatusArr: { $addToSet: '$groupStatus' }
                                    } 
                                }
                            ],
                            as: "cashCollections"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                                { $match: {
                                    $expr: {
                                        $and: [
                                            { $and: [{$lte: ['$startDateObj', '$currentDateObj']}, {$ne: ['$status', 'reject']}] },
                                            { $or: [
                                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}] },
                                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$transferred', true]}, {$eq: ['$endDate', date]}] },
                                                { $eq: ['$status', 'active'] }
                                            ] }
                                        ]
                                    } } 
                                },
                                { $group: { 
                                        _id: '$loId',
                                        activeClients: { $sum: {
                                            $cond: {
                                                if: { $ne: ['$status', 'pending'] },
                                                then: 1,
                                                else: {
                                                    $cond: {
                                                        if: { $and: [{$eq: ['$status', 'pending']}, {$gt: ['$loanCycle', 1]}] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                }
                                            }
                                        } },
                                        activeBorrowers: { $sum: { 
                                            $cond: {
                                                if: { $ne: ['$status', 'pending'] },
                                                then: {
                                                    $cond: {
                                                        if: {$and: [{$gt: ['$loanBalance', 0]}, {$gte: ['$currentDateObj', '$startDateObj']}]},
                                                        then: 1,
                                                        else: {
                                                            $cond: {
                                                                if: {$eq: ['$status', 'active']},
                                                                then: 1,
                                                                else: 0
                                                            }
                                                        }
                                                    }
                                                }, 
                                                else: 0
                                            } 
                                        } }
                                    } 
                                }
                            ],
                            as: "activeLoans"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                                { $match: {$expr:  {
                                    $and: [
                                        {$or: [ 
                                            {$eq: ['$status', 'active']}, 
                                            {$eq: ['$status', 'completed']}, 
                                            {$and: [
                                                { $or: [
                                                    { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}] },
                                                    { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$transferred', true]}, {$eq: ['$endDate', date]}] }
                                                ] }
                                            ]}
                                        ]}, 
                                        {$lte: ['$startDateObj', '$currentDateObj']}
                                    ]
                                } } },
                                { $group: { 
                                        _id: '$loId',
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
                                        pastDue: { $sum: '$pastDue' },
                                        noPastDue: { $sum: {
                                            $cond: {
                                                if: {$gt: ['$pastDue', 0] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        collection: { $sum: 0 },
                                        excess: { $sum: 0 },
                                        total: { $sum: 0 },
                                        mcbu: { $sum: '$mcbu' },
                                        mcbuInterest: { $sum: '$mcbuInterest' }
                                    } 
                                }
                            ],
                            as: "loans"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { status: 'active', dateGranted: date } },
                                { $group: {
                                        _id: '$loId',
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
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: {$expr: { $and: [
                                    {$or: [{$eq: ['$status', 'completed']}, {$eq: ['$status', 'closed']}]}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
                                ]}} },
                                { $group: {
                                        _id: '$loId',
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
                    { $project: { password: 0, profile: 0, role: 0 } }
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
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "groupIdStr",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { transfer: true, dateAdded: date } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$groupId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferReceivedDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "groupIdStr",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { transferred: true, dateAdded: date } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$groupId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferGiverDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "groupIdStr",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { $expr: { $and: [
                                    { $eq: ['$dateAdded', date] },
                                    { $or: [
                                        { $ifNull: ['$draft', 'Unspecified'] },
                                        { $eq: ['$draft', false] }
                                    ] }
                                ] } } },
                                { $group: { 
                                        _id: '$$groupName',
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: {
                                            $cond: {
                                                if: { $or: [
                                                    {$eq: ['$remarks.value', 'delinquent']},
                                                    {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                ] },
                                                then: '$prevData.activeLoan',
                                                else: 0
                                            }
                                        } },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        total: { $sum: '$total' },
                                        offsetPerson: { $sum: {
                                            $cond: {
                                                if: {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        mcbu: { $sum: '$mcbu' },
                                        mcbuTarget: { $sum: {
                                            $cond: {
                                                if: { $and: [{$eq: ['$occurence', 'weekly']}, {$eq: ['$groupDay', currentDay]}] },
                                                then: {
                                                    $cond: {
                                                        if: { $or: [
                                                            {$eq: ['$remarks.value', 'delinquent']},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                        ] },
                                                        then: 0,
                                                        else: 50
                                                    }
                                                },
                                                else: 0
                                            }
                                        } },
                                        mcbuCol: { $sum: '$mcbuCol' },
                                        mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                        mcbuReturnNo: { $sum: {
                                            $cond: {
                                                if: { $or: [
                                                    {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                    {$gt: ['$mcbuReturnAmt', 0]}
                                                ] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                        mcbuInterest: { $sum: '$mcbuInterest' },
                                        transfer: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferMCBU: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$mcbu',
                                                else: 0
                                            }
                                        } },
                                        transferAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        transferred: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferredAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferredLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        groupStatusArr: { $addToSet: '$groupStatus' }
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
                                { $match: {
                                    $expr: {
                                        $and: [
                                            { $and: [{$lte: ['$startDateObj', '$currentDateObj']}, {$ne: ['$status', 'reject']}] },
                                            { $or: [
                                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}] },
                                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$transferred', true]}, {$eq: ['$endDate', date]}] },
                                                { $eq: ['$status', 'active'] }
                                            ] }
                                        ]
                                    } } 
                                },
                                { $group: { 
                                        _id: '$$groupName',
                                        activeClients: { $sum: {
                                            $cond: {
                                                if: { $ne: ['$status', 'pending'] },
                                                then: 1,
                                                else: {
                                                    $cond: {
                                                        if: { $and: [{$eq: ['$status', 'pending']}, {$gt: ['$loanCycle', 1]}] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                }
                                            }
                                        } },
                                        activeBorrowers: { $sum: { 
                                            $cond: {
                                                if: { $ne: ['$status', 'pending'] },
                                                then: {
                                                    $cond: {
                                                        if: {$and: [{$gt: ['$loanBalance', 0]}, {$gte: ['$currentDateObj', '$startDateObj']}]},
                                                        then: 1,
                                                        else: {
                                                            $cond: {
                                                                if: {$eq: ['$status', 'active']},
                                                                then: 1,
                                                                else: 0
                                                            }
                                                        }
                                                    }
                                                }, 
                                                else: 0
                                            } 
                                        } }
                                    } 
                                }
                            ],
                            as: "activeLoans"
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
                                { $match: {$expr:  {
                                    $and: [
                                        {$or: [ 
                                            {$eq: ['$status', 'active']}, 
                                            {$eq: ['$status', 'completed']}, 
                                            {$and: [
                                                { $or: [
                                                    { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}] },
                                                    { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$transferred', true]}, {$eq: ['$endDate', date]}] }
                                                ] }
                                            ]}
                                        ]}, 
                                        {$lte: ['$startDateObj', '$currentDateObj']}
                                    ] } 
                                } },
                                { $group: { 
                                        _id: '$loId',
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
                                        pastDue: { $sum: '$pastDue' },
                                        noPastDue: { $sum: {
                                            $cond: {
                                                if: {$gt: ['$pastDue', 0] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        collection: { $sum: 0 },
                                        excess: { $sum: 0 },
                                        total: { $sum: 0 },
                                        mcbu: { $sum: '$mcbu' },
                                        mcbuInterest: { $sum: '$mcbuInterest' }
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
                                    {$or: [{$eq: ['$status', 'completed']}, {$eq: ['$status', 'closed']}]}, {$lte: ['$loanBalance', 0]}, {$eq: ['$fullPaymentDate', date]}
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
                    // {
                    //     $lookup: {
                    //         from: "cashCollections",
                    //         let: { groupName: '$name' },
                    //         localField: "groupIdStr",
                    //         foreignField: "groupId",
                    //         pipeline: [
                    //             { $match: { dateAdded: date, occurence: 'weekly', groupDay: dayName } },
                    //             { $group: {
                    //                     _id: '$$groupName',
                    //                     total: { $sum: {
                    //                         $cond: {
                    //                             if: { $or: [
                    //                                 {$eq: ['$remarks.value', 'delinquent']},
                    //                                 {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                    //                                 {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                    //                             ] },
                    //                             then: 0,
                    //                             else: 50
                    //                         }
                    //                     } }
                    //                 }
                    //             }
                    //         ],
                    //         as: "mcbuTarget"
                    //     }
                    // },
                    { $project: { groupIdStr: 0, availableSlots: 0 } },
                    { $sort: { groupNo: 1 } }
                ])
                .toArray();
        }
    } else {
        if (branchCode) {
            cashCollection = await db
                .collection('users')
                .aggregate([
                    { $match: { designatedBranch: branchCode, "role.rep": 4 } },
                    {
                        $addFields: {
                            "loIdStr": { $toString: "$_id" }
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transfer: true, dateAdded: date, occurence: 'daily' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferDailyReceivedDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transferred: true, dateAdded: date, occurence: 'daily' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferDailyGiverDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transfer: true, dateAdded: date, occurence: 'weekly' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferWeeklyReceivedDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { transferred: true, dateAdded: date, occurence: 'weekly' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$loId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferWeeklyGiverDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            localField: "loIdStr",
                            foreignField: "loId",
                            pipeline: [
                                { $match: { dateAdded: date } },
                                { $group: { 
                                        _id: '$loId',
                                        activeClients: { $sum: {
                                            $cond: {
                                                if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] },
                                                then: 1,
                                                else: {
                                                    $cond: {
                                                        if: { $and: [{$eq: ['$status', 'pending']}, {$gt: ['$loanCycle', 1]}] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                }
                                            }
                                        } },
                                        activeBorrowers: { $sum: { 
                                            $cond: {
                                                if: { $ne: ['$status', 'pending'] },
                                                then: {
                                                    $cond: {
                                                        if: {$gt: ['$loanBalance', 0]},
                                                        then: 1,
                                                        else: {
                                                            $cond: {
                                                                if: {$and: [{$eq: ['$status', 'tomorrow']}, {$eq: ['$loanBalance', 0]}]},
                                                                then: 1,
                                                                else: 0
                                                            }
                                                        }
                                                    }
                                                }, 
                                                else: 0
                                            } 
                                        } },
                                        totalRelease: { $sum: { $cond:{
                                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'tomorrow']}] }, 
                                            then: '$amountRelease', 
                                            else: 0
                                        } } },
                                        totalLoanBalance: { $sum: { $cond:{
                                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'tomorrow']}] }, 
                                            then: '$loanBalance', 
                                            else: 0
                                        } } },
                                        loanTarget: { 
                                            $sum: { 
                                                $cond: {
                                                    if: { $ne: ['$status', 'pending'] },
                                                    then: { 
                                                        $cond: {
                                                            if: { $or: [{$eq: ['$occurence', 'daily']}, {$and: [{ $and: [{ $eq: ['$occurence', 'weekly'] }, { $eq: ['$groupDay', dayName] }] }]}] },
                                                            then: {
                                                                $cond: {
                                                                    if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}] },
                                                                    then: '$history.activeLoan',
                                                                    else: {
                                                                        $cond: {
                                                                            if: { $or: [
                                                                                {$eq: ['$remarks.value', 'delinquent']},
                                                                                {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                                            ] },
                                                                            then: 0,
                                                                            else: {
                                                                                $cond: {
                                                                                    if: {$eq: ['$status', 'tomorrow']},
                                                                                    then: {
                                                                                        $cond: {
                                                                                            if: { $gt: ['$activeLoan', 0] },
                                                                                            then: '$history.activeLoan',
                                                                                            else: 0
                                                                                        }
                                                                                    },
                                                                                    else: '$activeLoan'
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            else: 0
                                                        } 
                                                    }, 
                                                    else: 0
                                                } 
                                            }
                                        },
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        pastDue: { $sum: '$pastDue' },
                                        noPastDue: { $sum: {
                                            $cond: {
                                                if: {$gt: ['$pastDue', 0] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        total: { $sum: '$total' },
                                        currentReleaseAmount: {
                                            $sum: {
                                                $cond: {
                                                    if: {$eq: ['$status', 'tomorrow']},
                                                    then: '$currentReleaseAmount',
                                                    else: 0
                                                }
                                            }
                                        },
                                        noOfCurrentRelease: {
                                            $sum: {
                                                $cond: {
                                                    if: {$eq: ['$status', 'tomorrow']},
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        newCurrentRelease: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$status', 'tomorrow']}, { $eq: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        reCurrentRelease: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$status', 'tomorrow']}, { $gt: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        fullPaymentAmount: {
                                            $sum: {
                                                $cond: {
                                                    if: { $eq: ['$fullPaymentDate', date] },
                                                    then: '$fullPayment',
                                                    else: 0
                                                }
                                            }
                                        },
                                        noOfFullPayment: {
                                            $sum: {
                                                $cond: {
                                                    if: { $eq: ['$fullPaymentDate', date] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        newFullPayment: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$fullPaymentDate', date]}, {$eq: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        reFullPayment: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$fullPaymentDate', date]}, {$gt: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        mcbu: { $sum: {
                                            $cond: {
                                                if: {$eq: ['$occurence', 'weekly']},
                                                then: '$mcbu',
                                                else: 0
                                            }
                                        } },
                                        mcbu: { $sum: '$mcbu' },
                                        mcbuCol: { $sum: '$mcbuCol' },
                                        mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                        mcbuReturnNo: { $sum: {
                                            $cond: {
                                                if: { $or: [
                                                    {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                    {$gt: ['$mcbuReturnAmt', 0]}
                                                ] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                        mcbuTarget: { $sum: {
                                            $cond: {
                                                if: { $and: [{$eq: ['$occurence', 'weekly']}, {$eq: ['$groupDay', dayName]}] },
                                                then: {
                                                    $cond: {
                                                        if: { $or: [
                                                            {$eq: ['$remarks.value', 'delinquent']},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                        ] },
                                                        then: 0,
                                                        else: 50
                                                    }
                                                },
                                                else: 0
                                            }
                                        } },
                                        mcbuInterest: { $sum: '$mcbuInterest' },
                                        transfer: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferMCBU: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$mcbu',
                                                else: 0
                                            }
                                        } },
                                        transferAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        transferred: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferredAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferredLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        groupStatusArr: { $addToSet: '$groupStatus' }
                                    } 
                                }
                            ],
                            as: "cashCollections"
                        }
                    },
                    { $project: { password: 0, profile: 0, role: 0 } }
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
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "groupIdStr",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { transfer: true, dateAdded: date } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$groupId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferReceivedDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "groupIdStr",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { transferred: true, dateAdded: date } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$groupId',
                                                    mcbuTarget: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$occurence', 'weekly'] },
                                                            then: '$mcbuTarget',
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuCol: { $sum: '$mcbuCol' },
                                                    targetCollection: { $sum: '$activeLoan' },
                                                    excess: { $sum: '$excess' },
                                                    actualCollection: { $sum: '$paymentCollection' },
                                                    mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                    mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                    mcbuNoReturn: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$mcbuReturnAmt', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    mcbuInterest: { $sum: '$mcbuInterest' },
                                                    mispay: { $sum: {
                                                        $cond: {
                                                            if: { $eq: ['$mispayment', true] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } },
                                                    pastDue: { $sum: '$pastDue' },
                                                    noPastDue: { $sum: {
                                                        $cond: {
                                                            if: { $gt: ['$pastDue', 0] },
                                                            then: 1,
                                                            else: 0
                                                        }
                                                    } }
                                                }
                                            }
                                        ],
                                        as: "data"
                                    }
                                }
                            ],
                            as: "transferGiverDetails"
                        }
                    },
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name' },
                            localField: "groupIdStr",
                            foreignField: "groupId",
                            pipeline: [
                                { $match: { dateAdded: date } },
                                { $group: { 
                                        _id: '$$groupName',
                                        activeClients: { $sum: {
                                            $cond: {
                                                if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'closed']}] },
                                                then: 1,
                                                else: {
                                                    $cond: {
                                                        if: { $and: [{$eq: ['$status', 'pending']}, {$gt: ['$loanCycle', 1]}] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                }
                                            }
                                        } },
                                        activeBorrowers: { $sum: { 
                                            $cond: {
                                                if: { $ne: ['$status', 'pending'] },
                                                then: {
                                                    $cond: {
                                                        if: {$gt: ['$loanBalance', 0]},
                                                        then: 1,
                                                        else: {
                                                            $cond: {
                                                                if: {$and: [{$eq: ['$status', 'tomorrow']}, {$eq: ['$loanBalance', 0]}]},
                                                                then: 1,
                                                                else: 0
                                                            }
                                                        }
                                                    }
                                                }, 
                                                else: 0
                                            } 
                                        } },
                                        totalRelease: { $sum: { $cond:{
                                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'tomorrow']}] }, 
                                            then: '$amountRelease', 
                                            else: 0
                                        } } },
                                        totalLoanBalance: { $sum: { $cond:{
                                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'tomorrow']}] }, 
                                            then: '$loanBalance', 
                                            else: 0
                                        } } },
                                        loanTarget: { 
                                            $sum: { 
                                                $cond: {
                                                    if: { $ne: ['$status', 'pending'] }, 
                                                    then: { 
                                                        $cond: {
                                                            if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}] },
                                                            then: '$history.activeLoan',
                                                            else: {
                                                                $cond: {
                                                                    if: { $or: [
                                                                        {$eq: ['$remarks.value', 'delinquent']},
                                                                        {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                                    ] },
                                                                    then: 0,
                                                                    else: {
                                                                        $cond: {
                                                                            if: {$eq: ['$status', 'tomorrow']},
                                                                            then: {
                                                                                $cond: {
                                                                                    if: { $gt: ['$activeLoan', 0] },
                                                                                    then: '$history.activeLoan',
                                                                                    else: 0
                                                                                }
                                                                            },
                                                                            else: '$activeLoan'
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        } 
                                                    }, 
                                                    else: 0
                                                } 
                                            }
                                        },
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        collection: { $sum: '$paymentCollection' },
                                        excess: { $sum: '$excess' },
                                        pastDue: { $sum: '$pastDue' },
                                        noPastDue: { $sum: {
                                            $cond: {
                                                if: {$gt: ['$pastDue', 0] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        total: { $sum: '$total' },
                                        currentReleaseAmount: {
                                            $sum: {
                                                $cond: {
                                                    if: {$eq: ['$status', 'tomorrow']},
                                                    then: '$currentReleaseAmount',
                                                    else: 0
                                                }
                                            }
                                        },
                                        noOfCurrentRelease: {
                                            $sum: {
                                                $cond: {
                                                    if: {$eq: ['$status', 'tomorrow']},
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        newCurrentRelease: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$status', 'tomorrow']}, { $eq: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        reCurrentRelease: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$status', 'tomorrow']}, { $gt: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        fullPaymentAmount: {
                                            $sum: {
                                                $cond: {
                                                    if: { $eq: ['$fullPaymentDate', date] },
                                                    then: '$fullPayment',
                                                    else: 0
                                                }
                                            }
                                        },
                                        noOfFullPayment: {
                                            $sum: {
                                                $cond: {
                                                    if: { $eq: ['$fullPaymentDate', date] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        newFullPayment: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$fullPaymentDate', date]}, {$eq: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        reFullPayment: {
                                            $sum: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$fullPaymentDate', date]}, {$gt: ['$loanCycle', 1]}] },
                                                    then: 1,
                                                    else: 0
                                                }
                                            }
                                        },
                                        mcbu: { $sum: '$mcbu' },
                                        mcbuCol: { $sum: '$mcbuCol' },
                                        mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                        mcbuReturnNo: { $sum: {
                                            $cond: {
                                                if: { $or: [
                                                    {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                    {$gt: ['$mcbuReturnAmt', 0]}
                                                ] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                        mcbuTarget: { $sum: {
                                            $cond: {
                                                if: { $and: [{$eq: ['$occurence', 'weekly']}, {$eq: ['$groupDay', dayName]}] },
                                                then: {
                                                    $cond: {
                                                        if: { $or: [
                                                            {$eq: ['$remarks.value', 'delinquent']},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                                                            {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                                                        ] },
                                                        then: 0,
                                                        else: 50
                                                    }
                                                },
                                                else: 0
                                            }
                                        } },
                                        mcbuInterest: { $sum: '$mcbuInterest' },
                                        transfer: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferMCBU: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$mcbu',
                                                else: 0
                                            }
                                        } },
                                        transferAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transfer', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        transferred: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } },
                                        transferredAmountRelease: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$amountRelease',
                                                else: 0
                                            }
                                        } },
                                        transferredLoanBalance: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: '$loanBalance',
                                                else: 0
                                            }
                                        } },
                                        groupStatusArr: { $addToSet: '$groupStatus' }
                                    } 
                                }
                            ],
                            as: "cashCollections"
                        }
                    },
                    { $project: { groupIdStr: 0, availableSlots: 0 } },
                    { $sort: { groupNo: 1 } }
                ])
                .toArray();
        }
    }

    if (cashCollection.length > 0 && mode === 'weekly') {
        cashCollection = cashCollection
    }
        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}