import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';
import { faL } from 'node_modules/@fortawesome/free-solid-svg-icons/index';

export default apiHandler({
    get: getAllLoansPerGroup
});

async function getAllLoansPerGroup(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const { date, mode, areaManagerId, dayName, currentDate } = req.query;

    const currentDay = moment(date).format('dddd').toLowerCase();

    let statusCode = 200;
    let response = {};
    let cashCollection;
    
    if (currentDate === date) {
        if (areaManagerId) {
            const areaManager = await db.collection("users").find({ _id: new ObjectId(areaManagerId) }).toArray();
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
                                from: "groups",
                                localField: "branchIdstr",
                                foreignField: "branchId",
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
                                localField: "branchIdstr",
                                foreignField: "branchId",
                                pipeline: [
                                    { $match: { dateAdded: date, draft: false } },
                                    { $group: { 
                                            _id: '$branchId',
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
                                            transferred: { $sum: {
                                                $cond: {
                                                    if: { $eq: ['$transferred', true] },
                                                    then: 1,
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
                                localField: "branchIdstr",
                                foreignField: "branchId",
                                pipeline: [
                                    { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                                    { $match: {$expr:  {$and: [
                                                {$or: [
                                                    {$ne: ['$status', 'closed']},
                                                    {$and: [
                                                        {$eq: ['$status', 'closed']},
                                                        {$eq: ['$transferred', true]},
                                                        {$eq: ['$endDate', date]}
                                                    ]}
                                                ]},
                                                {$ne: ['$status', 'reject']}
                                            ]} } },
                                    { $group: { 
                                            _id: '$branchId',
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
                                localField: "branchIdstr",
                                foreignField: "branchId",
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
                                                                if: { $and: [{$eq: ['$occurence', 'weekly']}, {$eq: ['$groupDay', dayName]}] },
                                                                then: {
                                                                    $cond: {
                                                                        if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}] },
                                                                        then: '$history.activeLoan',
                                                                        else: '$activeLoan'
                                                                    }
                                                                },
                                                                else: {
                                                                    $cond: {
                                                                        if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}, {$eq: ['$occurence', 'daily']}] },
                                                                        then: '$history.activeLoan',
                                                                        else:  {
                                                                            $cond: {
                                                                                if: {$eq: ['$occurence', 'daily']},
                                                                                then: '$activeLoan',
                                                                                else: 0
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
                                            mcbu: { $sum: {
                                                $cond: {
                                                    if: { $eq: ['$occurence', 'weekly'] },
                                                    then: {
                                                        $cond: {
                                                            if: { $eq: ['$groupDay', dayName] },
                                                            then: '$mcbu',
                                                            else: 0
                                                        },
                                                    },
                                                    else: '$mcbu'
                                                }
                                            } },
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
                            from: "groups",
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: { occurence: 'weekly', day: currentDay } },
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
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: { dateAdded: date, draft: false } },
                                { $group: { 
                                        _id: '$branchId',
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
                                        transferred: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: 1,
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
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                                { $match: {$expr:  {$and: [
                                        {$or: [
                                            {$ne: ['$status', 'closed']},
                                            {$and: [
                                                {$eq: ['$status', 'closed']},
                                                {$eq: ['$transferred', true]},
                                                {$eq: ['$endDate', date]}
                                            ]}
                                        ]},
                                        {$ne: ['$status', 'reject']}
                                        ]} } },
                                { $group: { 
                                        _id: '$branchId',
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
                            localField: "branchIdstr",
                            foreignField: "branchId",
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
                                                            if: { $and: [{$eq: ['$occurence', 'weekly']}, {$eq: ['$groupDay', dayName]}] },
                                                            then: {
                                                                $cond: {
                                                                    if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}] },
                                                                    then: '$history.activeLoan',
                                                                    else: '$activeLoan'
                                                                }
                                                            },
                                                            else: {
                                                                $cond: {
                                                                    if: { $and: [{$eq: ['$activeLoan', 0]}, {$eq: ['$fullPaymentDate', date]}, {$eq: ['$occurence', 'daily']}] },
                                                                    then: '$history.activeLoan',
                                                                    else:  {
                                                                        $cond: {
                                                                            if: {$eq: ['$occurence', 'daily']},
                                                                            then: '$activeLoan',
                                                                            else: 0
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
                                        mcbu: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$occurence', 'weekly'] },
                                                then: {
                                                    $cond: {
                                                        if: { $eq: ['$groupDay', dayName] },
                                                        then: '$mcbu',
                                                        else: 0
                                                    },
                                                },
                                                else: '$mcbu'
                                            }
                                        } },
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
    } else {
        if (areaManagerId) {
            const areaManager = await db.collection("users").find({ _id: new ObjectId(areaManagerId) }).toArray();
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
                                from: "cashCollections",
                                localField: "branchIdstr",
                                foreignField: "branchId",
                                pipeline: [
                                    { $match: { dateAdded: date } },
                                    { $group: { 
                                            _id: '$branchId',
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
                                            mcbu: { $sum: {
                                                $cond: {
                                                    if: { $eq: ['$occurence', 'weekly'] },
                                                    then: {
                                                        $cond: {
                                                            if: { $eq: ['$groupDay', dayName] },
                                                            then: '$mcbu',
                                                            else: 0
                                                        },
                                                    },
                                                    else: '$mcbu'
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
                                            transferred: { $sum: {
                                                $cond: {
                                                    if: { $eq: ['$transferred', true] },
                                                    then: 1,
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
                            from: "cashCollections",
                            localField: "branchIdstr",
                            foreignField: "branchId",
                            pipeline: [
                                { $match: { dateAdded: date } },
                                { $group: { 
                                        _id: '$branchId',
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
                                        mcbu: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$occurence', 'weekly'] },
                                                then: {
                                                    $cond: {
                                                        if: { $eq: ['$groupDay', dayName] },
                                                        then: '$mcbu',
                                                        else: 0
                                                    },
                                                },
                                                else: '$mcbu'
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
                                        transferred: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$transferred', true] },
                                                then: 1,
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
                        $sort: { code: 1 }
                    }
                ])
                .toArray();
        }
    }
     
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}