import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';
import logger from '@/logger';

export default apiHandler({
    get: getData
});

async function getData(req, res) {
    const { date, mode, loIds, dayName, currentDate } = req.query;
    let statusCode = 200;
    let response = {};

    const loIdsObj = JSON.parse(loIds);
    const data = [];

    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(loIdsObj.map(async (loId) => {
            logger.debug({page: 'Loan Officer Collections', message: `Getting data for loan officer id: ${loId}`});
            data.push.apply(data, await getAllLoansPerGroup(date, mode, loId, dayName, currentDate));
        }));

        resolve(response);
    });

    if (promise) {
        data.sort((a, b) => { return a.loNo - b.loNo });
        response = { success: true, data: data };
    }
    else {
        statusCode = 500;
        response = { error: true, message: "Error fetching data" };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoansPerGroup(date, mode, loId, dayName, currentDate) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const currentDay = moment(date).format('dddd').toLowerCase();
    let cashCollection;
    let transferCollections = [];
    let draftCollections = [];

    if (currentDate === date) {
        cashCollection = await db
            .collection('users')
            .aggregate([
                { $match: { _id: new ObjectId(loId) } },
                {
                    $addFields: {
                        "loIdStr": { $toString: "$_id" }
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
                                { $ne: ['$status', 'pending'] },
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
                                                {$eq: ['$remarks.value', 'delinquent-mcbu']},
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
                                                        {$eq: ['$remarks.value', 'delinquent-mcbu']},
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
                                    groupStatusArr: { $addToSet: {
                                        $cond: {
                                            if: { $and: [
                                                {$ne: ['$status', 'pending']},
                                                {$and: [
                                                    {$ne: ['$status', 'tomorrow']},
                                                    {$ne: ['$loanCycle', 1]}
                                                ]},
                                            ] },
                                            then: '$groupStatus',
                                            else: "$$REMOVE"
                                        }
                                    } },
                                    hasDraftsArr: { $addToSet: '$draft' }
                                } 
                            }
                        ],
                        as: "cashCollections"
                    }
                },
                // {
                //     $lookup: {
                //         from: "cashCollections",
                //         localField: "loIdStr",
                //         foreignField: "loId",
                //         pipeline: [
                //             { $match: { $expr: { $and: [
                //                 { $eq: ['$draft', true] },
                //                 { $ne: ['$dateAdded', date] }
                //             ] } } },
                //             { $group: { 
                //                     _id: '$loId',
                //                     mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                //                     loanTarget: { $sum: {
                //                         $cond: {
                //                             if: { $or: [
                //                                 {$eq: ['$remarks.value', 'delinquent']},
                //                                 {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                //                             ] },
                //                             then: '$prevData.activeLoan',
                //                             else: 0
                //                         }
                //                     } },
                //                     collection: { $sum: '$paymentCollection' },
                //                     excess: { $sum: '$excess' },
                //                     total: { $sum: '$total' },
                //                     offsetPerson: { $sum: {
                //                         $cond: {
                //                             if: {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                //                             then: 1,
                //                             else: 0
                //                         }
                //                     } },
                //                     mcbu: { $sum: '$mcbu' },
                //                     mcbuTarget: { $sum: {
                //                         $cond: {
                //                             if: { $and: [{$eq: ['$occurence', 'weekly']}, {$eq: ['$groupDay', currentDay]}] },
                //                             then: {
                //                                 $cond: {
                //                                     if: { $or: [
                //                                         {$eq: ['$remarks.value', 'delinquent']},
                //                                         {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                //                                         {$regexMatch: { input: '$remarks.value', regex: /^excused/ }}
                //                                     ] },
                //                                     then: 0,
                //                                     else: 50
                //                                 }
                //                             },
                //                             else: 0
                //                         }
                //                     } },
                //                     mcbuCol: { $sum: '$mcbuCol' },
                //                     mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                //                     mcbuReturnNo: { $sum: {
                //                         $cond: {
                //                             if: { $or: [
                //                                 {$regexMatch: { input: '$remarks.value', regex: /^offset/ }},
                //                                 {$gt: ['$mcbuReturnAmt', 0]}
                //                             ] },
                //                             then: 1,
                //                             else: 0
                //                         }
                //                     } },
                //                     mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                //                     mcbuInterest: { $sum: '$mcbuInterest' },
                //                     transfer: { $sum: {
                //                         $cond: {
                //                             if: { $eq: ['$transfer', true] },
                //                             then: 1,
                //                             else: 0
                //                         }
                //                     } },
                //                     transferMCBU: { $sum: {
                //                         $cond: {
                //                             if: { $eq: ['$transfer', true] },
                //                             then: '$mcbu',
                //                             else: 0
                //                         }
                //                     } },
                //                     transferAmountRelease: { $sum: {
                //                         $cond: {
                //                             if: { $eq: ['$transfer', true] },
                //                             then: '$amountRelease',
                //                             else: 0
                //                         }
                //                     } },
                //                     transferLoanBalance: { $sum: {
                //                         $cond: {
                //                             if: { $eq: ['$transfer', true] },
                //                             then: '$loanBalance',
                //                             else: 0
                //                         }
                //                     } },
                //                     transferred: { $sum: {
                //                         $cond: {
                //                             if: { $eq: ['$transferred', true] },
                //                             then: 1,
                //                             else: 0
                //                         }
                //                     } },
                //                     transferredAmountRelease: { $sum: {
                //                         $cond: {
                //                             if: { $eq: ['$transferred', true] },
                //                             then: '$amountRelease',
                //                             else: 0
                //                         }
                //                     } },
                //                     transferredLoanBalance: { $sum: {
                //                         $cond: {
                //                             if: { $eq: ['$transferred', true] },
                //                             then: '$loanBalance',
                //                             else: 0
                //                         }
                //                     } },
                //                     groupStatusArr: { $addToSet: {
                //                         $cond: {
                //                             if: { $ne: ['$status', 'pending'] },
                //                             then: '$groupStatus',
                //                             else: "$$REMOVE"
                //                         }
                //                     } },
                //                     hasDraftsArr: { $addToSet: '$draft' }
                //                 } 
                //             }
                //         ],
                //         as: "draftCollections"
                //     }
                // },
                {
                    $lookup: {
                        from: "loans",
                        localField: "loIdStr",
                        foreignField: "loId",
                        pipeline: [
                            { $match: {
                                $expr: {
                                    $and: [
                                        {$ne: ['$status', 'reject']},
                                        { $or: [
                                            { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}, {$ne: ['$transferredReleased', true]}] },
                                            { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$closedDate', date]}] },
                                            { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$transferred', true]}, {$eq: ['$transferredDate', date]}] },
                                            { $eq: ['$status', 'active'] }, { $eq: ['$status', 'pending'] }, { $eq: ['$status', 'completed'] }
                                        ] }
                                    ]
                                } } 
                            },
                            { $group: { 
                                    _id: '$loId',
                                    activeClients: { $sum: {
                                        $cond: {
                                            if: {$and: [{ $ne: ['$status', 'pending'] }, { $ne: ['$status', 'closed'] }]},
                                            then: 1,
                                            else: {
                                                $cond: {
                                                    if: { $and: [{$eq: ['$status', 'pending']}, {$gt: ['$loanCycle', 1]}, {$ne: ['$advanceTransaction', true]}] },
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
                                                    if: {$eq: ['$status', 'active']},
                                                    then: 1,
                                                    else: 0
                                                }
                                            }, 
                                            else: 0
                                        } 
                                    } },
                                    pendingClients: { $sum: { 
                                        $cond: {
                                            if: { $eq: ['$status', 'completed'] },
                                            then: 1,
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
                                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$fullPaymentDate', date]}, {$ne: ['$transferredReleased', true]}] },
                                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$closedDate', date]}] },
                                                { $and: [ {$eq: ['$status', 'closed']}, {$eq: ['$transferred', true]}, {$eq: ['$transferredDate', date]}] },
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
                {
                    $lookup: {
                        from: "groups",
                        localField: "loIdStr",
                        foreignField: "loanOfficerId",
                        pipeline: [
                            { $match: { $expr: { $and: [
                                { $eq: ['$day', currentDay] },
                                { $gt: ['$noOfClients', 0] },
                                { $eq: ['$occurence', 'weekly'] }
                            ] } } },
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
                                                            if: {$and: [{ $ne: ['$status', 'pending']}, { $ne: ['$status', 'reject']}, {$lte: ['$startDateObj', '$currentDateObj']} ]}, 
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
                                                // mcbuTarget: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$occurence', 'weekly'] },
                                                //         then: '$mcbuTarget',
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuCol: { $sum: '$mcbuCol' },
                                                // excess: { $sum: '$excess' },
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                // mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                // mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                // mcbuNoReturn: { $sum: {
                                                //     $cond: {
                                                //         if: { $gt: ['$mcbuReturnAmt', 0] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuInterest: { $sum: '$mcbuInterest' },
                                                // mispay: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$mispayment', true] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                                                // mcbuTarget: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$occurence', 'weekly'] },
                                                //         then: '$mcbuTarget',
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuCol: { $sum: '$mcbuCol' },
                                                // excess: { $sum: '$excess' },
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                // mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                // mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                // mcbuNoReturn: { $sum: {
                                                //     $cond: {
                                                //         if: { $gt: ['$mcbuReturnAmt', 0] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuInterest: { $sum: '$mcbuInterest' },
                                                // mispay: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$mispayment', true] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                                                // mcbuTarget: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$occurence', 'weekly'] },
                                                //         then: '$mcbuTarget',
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuCol: { $sum: '$mcbuCol' },
                                                // excess: { $sum: '$excess' },
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                // mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                // mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                // mcbuNoReturn: { $sum: {
                                                //     $cond: {
                                                //         if: { $gt: ['$mcbuReturnAmt', 0] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuInterest: { $sum: '$mcbuInterest' },
                                                // mispay: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$mispayment', true] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                                                // mcbuTarget: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$occurence', 'weekly'] },
                                                //         then: '$mcbuTarget',
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuCol: { $sum: '$mcbuCol' },
                                                // excess: { $sum: '$excess' },
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                // mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                // mcbuReturnAmt: { $sum: '$mcbuReturnAmt' },
                                                // mcbuNoReturn: { $sum: {
                                                //     $cond: {
                                                //         if: { $gt: ['$mcbuReturnAmt', 0] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                // mcbuInterest: { $sum: '$mcbuInterest' },
                                                // mispay: { $sum: {
                                                //     $cond: {
                                                //         if: { $eq: ['$mispayment', true] },
                                                //         then: 1,
                                                //         else: 0
                                                //     }
                                                // } },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                { $project: { password: 0, profile: 0, role: 0 } }
            ])
            .toArray();
    } else {
        cashCollection = await db
            .collection('users')
            .aggregate([
                { $match: { _id: new ObjectId(loId) } },
                {
                    $addFields: {
                        "loIdStr": { $toString: "$_id" }
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
                                    pendingClients: { $sum: { 
                                        $cond: {
                                            if: { $eq: ['$status', 'completed'] },
                                            then: 1,
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
                                                                            {$eq: ['$remarks.value', 'delinquent-mcbu']},
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
                                                        {$eq: ['$remarks.value', 'delinquent-mcbu']},
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
                                    groupStatusArr: { $addToSet: {
                                        $cond: {
                                            if: { $and: [
                                                {$ne: ['$status', 'pending']},
                                                {$and: [
                                                    {$ne: ['$status', 'tomorrow']},
                                                    {$ne: ['$loanCycle', 1]}
                                                ]},
                                            ] },
                                            then: '$groupStatus',
                                            else: "$$REMOVE"
                                        }
                                    } },
                                    hasDraftsArr: { $addToSet: '$draft' }
                                } 
                            }
                        ],
                        as: "cashCollections"
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
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                                                amountRelease: { $last: '$amountRelease' },
                                                loanBalance: { $last: '$loanBalance' },
                                                pastDue: { $sum: '$pastDue' },
                                                noPastDue: { $sum: {
                                                    $cond: {
                                                        if: { $gt: ['$pastDue', 0] },
                                                        then: 1,
                                                        else: 0
                                                    }
                                                } }
                                            }
                                        },
                                        {
                                            $addFields: { 
                                                actualCollection: { $subtract: ['$amountRelease', '$loanBalance'] }
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
                { $project: { password: 0, profile: 0, role: 0 } }
            ])
            .toArray();
    }

    if (cashCollection.length > 0 && mode === 'weekly') {
        cashCollection = cashCollection
    }

    // if (cashCollection.length > 0) {
    //     cashCollection[0].transferDailyReceivedDetails = [];
    //     cashCollection[0].transferDailyGiverDetails = [];
    //     cashCollection[0].transferWeeklyReceivedDetails = [];
    //     cashCollection[0].transferWeeklyGiverDetails = [];
    //     cashCollection[0].draftCollections = [];

    //     if (transferCollections.length > 0) {
    //         cashCollection[0].transferDailyReceivedDetails = transferCollections[0].transferDailyReceivedDetails;
    //         cashCollection[0].transferDailyGiverDetails = transferCollections[0].transferDailyGiverDetails;
    //         cashCollection[0].transferWeeklyReceivedDetails = transferCollections[0].transferWeeklyReceivedDetails;
    //         cashCollection[0].transferWeeklyGiverDetails = transferCollections[0].transferWeeklyGiverDetails;
    //     }

    //     if (draftCollections.length > 0) {
    //         cashCollection[0].draftCollections = draftCollections[0].draftCollections;
    //     }
    // }

    return cashCollection;
}