import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';
import { transferBranchDetailsTotal } from '@/lib/transfer-util';
import { formatPricePhp } from '@/lib/utils';

export default apiHandler({
    get: getData
});

async function getData(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const { date, currentUserId, selectedBranchGroup, dayName, currentDate } = req.query;

    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
        if (!user) {
            throw new Error('User not found');
        }

        const branchIds = await getBranchIds(db, user, selectedBranchGroup);
        
        // Step 4: Batching
        const BATCH_SIZE = 50;
        let processedData = [];
        for (let i = 0; i < branchIds.length; i += BATCH_SIZE) {
            const batchBranchIds = branchIds.slice(i, i + BATCH_SIZE);
            const batchData = await getAllLoanTransactionsByBranches(db, batchBranchIds, date, dayName, currentDate);
            const batchProcessedData = await processData(batchData, date, currentDate);
            processedData = processedData.concat(batchProcessedData);
        }

        processedData.sort((a, b) => a.name.localeCompare(b.name));

        response = { success: true, data: processedData };
    } catch (error) {
        logger.error({ page: 'Branch Collections', message: error.message });
        statusCode = 500;
        response = { error: true, message: "Error fetching data" };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getBranchIds(db, user, selectedBranchGroup) {
    if (selectedBranchGroup === 'mine' && user.role.rep !== 1) {
        let query = {};
        if (user.areaId && user.role.shortCode === 'area_admin') {
            query = { areaId: user.areaId };
        } else if (user.regionId && user.role.shortCode === 'regional_manager') {
            query = { regionId: user.regionId };
        } else if (user.divisionId && user.role.shortCode === 'deputy_director') {
            query = { divisionId: user.divisionId };
        }
        const branches = await db.collection('branches').find(query).project({ _id: 1 }).toArray();
        return branches.map(branch => branch._id.toString());
    } else {
        const branches = await db.collection('branches').find({}).project({ _id: 1 }).toArray();
        return branches.map(branch => branch._id.toString());
    }
}

async function getAllLoanTransactionsByBranches(db, branchIds, date, dayName, currentDate) {
    const ObjectId = require('mongodb').ObjectId;

    const pipeline = [
        {
            $match: { _id: { $in: branchIds.map(id => new ObjectId(id)) } }
        },
        {
            $addFields: {
                "branchIdstr": { $toString: "$_id" }
            }
        },
        {
            $facet: {
                cashCollections: [
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { branchId: "$branchIdstr" },
                            pipeline: [
                                    { $match: { 
                                        $expr: { $eq: ["$branchId", "$$branchId"] },
                                        dateAdded: date,
                                        status: { $ne: 'pending' },
                                        $or: [
                                            { draft: { $exists: false } },
                                            { draft: false }
                                        ]
                                    } },
                                    { $group: { 
                                        _id: '$branchId',
                                        mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                        loanTarget: { $sum: {
                                            $cond: {
                                                if: { $or: [
                                                    {$eq: ['$remarks.value', 'delinquent']},
                                                    {$eq: ['$remarks.value', 'delinquent-mcbu']},
                                                    {$eq: ['$remarks.value', 'excused advance payment']},
                                                    {$regexMatch: { input: '$remarks.value', regex: /^excused-/ }}
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
                                        groupStatusArr: { $addToSet: {
                                            $cond: {
                                                if: { $or: [
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
                    }
                ],
                activeLoans: [
                    {
                        $lookup: {
                            from: "loans",
                            let: { branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$branchId", "$$branchId"] },
                                            { $ne: ['$status', 'reject'] },
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
                                        _id: '$branchId',
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
                                                if: { $and: [ {$eq: ['$status', 'completed']}, {$ne: ['$transferred', true]} ] },
                                                then: 1,
                                                else: 0
                                            } 
                                        } }
                                    } 
                                }
                            ],
                            as: "activeLoans"
                        }
                    }
                ],
                loans: [
                    {
                        $lookup: {
                            from: "loans",
                            let: { branchId: "$branchIdstr" },
                            pipeline: [
                                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                                { $match: {$expr:  {
                                    $and: [
                                        { $eq: ["$branchId", "$$branchId"] },
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
                                        mcbu: { $sum: '$mcbu'},
                                        mcbuInterest: { $sum: '$mcbuInterest' },
                                        loIds: { $addToSet: '$loId' }
                                    } 
                                }
                            ],
                            as: "loans"
                        }
                    }
                ],
                currentRelease: [
                    {
                        $lookup: {
                            from: "loans",
                            let: { branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$branchId", "$$branchId"] }, status: 'active', dateGranted: date } },
                                { $group: {
                                        _id: '$branchId',
                                        currentReleaseAmount: { $sum: { $cond: { if: { $ne: ['$transfer', true] }, then: '$amountRelease', else: 0 } } },
                                        noOfCurrentRelease: { $sum: { $cond: { if: { $ne: ['$transfer', true] }, then: 1, else: 0 } } },
                                        newCurrentRelease: { $sum: { $cond:{if: { $eq: ['$loanCycle', 1] }, then: 1, else: 0} } },
                                        reCurrentRelease: { $sum: { $cond:{if: { $gt: ['$loanCycle', 1] }, then: 1, else: 0} } }
                                    }
                                }
                            ],
                            as: "currentRelease"
                        }
                    }
                ],
                fullPayment: [
                    {
                        $lookup: {
                            from: "loans",
                            let: { branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: {$expr: { $and: [
                                    { $eq: ["$branchId", "$$branchId"] },
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
                ],
                transferDailyReceivedDetails: [
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name', branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$branchId", "$$branchId"] }, transfer: true, dateAdded: date, occurence: 'daily' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$branchId',
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
                    }
                ],
                transferDailyGiverDetails: [
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name', branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$branchId", "$$branchId"] }, transferred: true, dateAdded: date, occurence: 'daily' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$branchId',
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
                    }
                ],
                transferWeeklyReceivedDetails: [
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name', branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$branchId", "$$branchId"] }, transfer: true, dateAdded: date, occurence: 'weekly' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "oldLoanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$branchId',
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
                    }
                ],
                transferWeeklyGiverDetails: [
                    {
                        $lookup: {
                            from: "cashCollections",
                            let: { groupName: '$name', branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$branchId", "$$branchId"] }, transferred: true, dateAdded: date, occurence: 'weekly' } },
                                {
                                    $lookup: {
                                        from: "cashCollections",
                                        localField: "loanId",
                                        foreignField: "loanId",
                                        pipeline: [
                                            {
                                                $group: {
                                                    _id: '$branchId',
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
                    }
                ],
                cashOnHand: [
                    {
                        $lookup: {
                            from: "branchCOH",
                            let: { branchId: "$branchIdstr" },
                            pipeline: [
                                { $match: { $expr: { $eq: ["$branchId", "$$branchId"] }, dateAdded: date } }
                            ],
                            as: "cashOnHand"
                        }
                    }
                ]
            }
        },
        {
            $project: {
                _id: 1,
                code: 1,
                name: 1,
                cashCollections: { $arrayElemAt: ["$cashCollections.cashCollections", 0] },
                activeLoans: { $arrayElemAt: ["$activeLoans.activeLoans", 0] },
                loans: { $arrayElemAt: ["$loans.loans", 0] },
                currentRelease: { $arrayElemAt: ["$currentRelease.currentRelease", 0] },
                fullPayment: { $arrayElemAt: ["$fullPayment.fullPayment", 0] },
                transferDailyReceivedDetails: { $arrayElemAt: ["$transferDailyReceivedDetails.transferDailyReceivedDetails", 0] },
                transferDailyGiverDetails: { $arrayElemAt: ["$transferDailyGiverDetails.transferDailyGiverDetails", 0] },
                transferWeeklyReceivedDetails: { $arrayElemAt: ["$transferWeeklyReceivedDetails.transferWeeklyReceivedDetails", 0] },
                transferWeeklyGiverDetails: { $arrayElemAt: ["$transferWeeklyGiverDetails.transferWeeklyGiverDetails", 0] },
                cashOnHand: { $arrayElemAt: ["$cashOnHand.cashOnHand", 0] }
            }
        }
    ];

    return await db.collection('branches').aggregate(pipeline).toArray();
}

async function processData(data, date, currentDate) {
    const collectionDailyTransferred = [];
    const collectionDailyReceived = [];
    const collectionWeeklyTransferred = [];
    const collectionWeeklyReceived = [];
    let collectionData = [];

    let noOfClients = 0;
    let noOfBorrowers = 0;
    let noOfPendings = 0;
    let totalsLoanRelease = 0;
    let totalsLoanBalance = 0;
    let noOfNewCurrentRelease = 0;
    let noOfReCurrentRelease = 0;
    let currentReleaseAmount = 0;
    let targetLoanCollection = 0;
    let excess = 0;
    let totalLoanCollection = 0;
    let noOfFullPayment = 0;
    let fullPaymentAmount = 0;
    let mispayment = 0;
    let totalPastDue = 0;
    let totalNoPastDue = 0;
    let totalMcbu = 0;
    let totalMcbuCol = 0;
    let totalMcbuWithdrawal = 0;
    let totalMcbuReturnNo = 0;
    let totalMcbuReturnAmt = 0;
    // let totalMcbuDailyWithdrawal = 0;
    let totalTransfer = 0;
    let totalCOH = 0;

    const filter = date !== currentDate;
    
    data.map(branch => {
        let collection = {
            _id: branch._id,
            name: branch.code + ' - ' + branch.name,
            noCurrentReleaseStr: '-',
            currentReleaseAmountStr: '-',
            activeClients: '-',
            activeBorrowers: '-',
            pendingClients: '-',
            totalReleasesStr: '-',
            totalLoanBalanceStr: '-',
            loanTargetStr: '-',
            mcbuStr: '-',
            mcbuColStr: '-',
            mcbuWithdrawalStr: '-',
            // mcbuDailyWithdrawalStr: '-',
            mcbuReturnAmtStr: '-',
            excessStr: '-',
            totalStr: '-',
            mispaymentStr: '-',
            fullPaymentAmountStr: '-',
            noOfFullPayment: '-',
            pastDueStr: '-',
            noPastDue: '-',
            transfer: '-',
            cohStr: '-',
            page: 'branch-summary',
            status: '-'
        };

        let groupStatus = 'open';
        if (branch?.draftCollections?.length > 0) {
            const transactionStatus = branch.draftCollections[0].groupStatusArr.filter(status => status === "pending");
            const draft = branch.draftCollections[0].hasDraftsArr.filter(d => d === true);
            if (transactionStatus.length == 0 && draft.length == 0) {
                groupStatus = 'close';
            }
        } else if (branch.cashCollections.length > 0) {
            const transactionStatus = branch.cashCollections[0].groupStatusArr.filter(status => status === "pending");
            const draft = branch.cashCollections[0].hasDraftsArr.filter(d => d === true);
            if (transactionStatus.length == 0 && draft.length == 0) {
                groupStatus = 'close';
            }
        }

        if (!filter) {
            if (branch.activeLoans.length > 0) {
                collection.activeClients = branch.activeLoans[0].activeClients; 
                collection.activeBorrowers = branch.activeLoans[0].activeBorrowers;
                collection.pendingClients = branch.activeLoans[0].pendingClients;
                noOfClients += branch.activeLoans[0].activeClients;
                noOfBorrowers += branch.activeLoans[0].activeBorrowers;
                noOfPendings += branch.activeLoans[0].pendingClients;
            }

            if (branch.loans.length > 0) {
                collection.totalReleases = branch.loans[0].totalRelease;
                collection.totalReleasesStr = collection.totalReleases > 0 ? formatPricePhp(collection.totalReleases) : '-';
                collection.totalLoanBalance = branch.loans[0].totalLoanBalance;
                collection.totalLoanBalanceStr = collection.totalLoanBalance > 0 ? formatPricePhp(collection.totalLoanBalance) : '-';
                collection.loanTarget = branch.loans[0].loanTarget;
                collection.loanTargetStr = branch.loans[0].loanTarget > 0 ? formatPricePhp(branch.loans[0].loanTarget) : '-';
                collection.pastDue = branch.loans[0].pastDue;
                collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                collection.noPastDue = branch.loans[0].noPastDue;
                collection.mcbu = branch.loans[0].mcbu;
                collection.mcbuStr = branch.loans[0].mcbu > 0 ? formatPricePhp(branch.loans[0].mcbu) : '-';
                collection.mcbuCol = 0;
                collection.mcbuColStr = '-';
                collection.mcbuWithdrawal = 0;
                collection.mcbuWithdrawalStr = '-';
                // collection.mcbuDailyWithdrawal = 0;
                // collection.mcbuDailyWithdrawalStr = '-';
                collection.noMcbuReturn = 0;
                collection.mcbuReturnAmt = 0;
                collection.mcbuReturnAmtStr = '-';
                collection.status = groupStatus;

                totalsLoanRelease += collection.totalReleases;
                totalsLoanBalance += collection.totalLoanBalance;
                totalPastDue += collection.pastDue;
                totalNoPastDue += collection.noPastDue;
                // totalMcbu += collection.mcbu;
            }
            
            if (branch.cashCollections.length > 0 && branch.cashCollections[0].collection > 0) {
                const loanTarget = collection.loanTarget - branch.cashCollections[0].loanTarget;

                collection.loanTarget = loanTarget;
                collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                collection.total = branch.cashCollections[0].collection;
                collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                collection.mispaymentStr = branch.cashCollections[0].mispayment > 0 ? branch.cashCollections[0].mispayment : '-';
                collection.mcbu = branch.cashCollections[0].mcbu;
                collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                collection.mcbuCol = branch.cashCollections[0].mcbuCol;
                collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal;
                collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                // collection.mcbuDailyWithdrawal = branch.cashCollections[0].mcbuDailyWithdrawal;
                // collection.mcbuDailyWithdrawalStr = collection.mcbuDailyWithdrawal ? formatPricePhp(collection.mcbuDailyWithdrawal) : '-';
                collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo;
                collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt;
                collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                collection.transfer = 0;
                collection.transferStr = '-';

                excess += branch.cashCollections[0].excess;
                totalLoanCollection += branch.cashCollections[0].collection;
                mispayment += branch.cashCollections[0].mispayment;
                // totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                // totalMcbuDailyWithdrawal += collection.mcbuDailyWithdrawal ? collection.mcbuDailyWithdrawal : 0;
                totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
            }

            if (branch.currentRelease.length > 0) {
                const newReleasePerson = branch.currentRelease[0].newCurrentRelease ? branch.currentRelease[0].newCurrentRelease : 0;
                const reReleasePerson = branch.currentRelease[0].reCurrentRelease ? branch.currentRelease[0].reCurrentRelease : 0;
                collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                collection.currentReleaseAmountStr = formatPricePhp(branch.currentRelease[0].currentReleaseAmount);

                noOfNewCurrentRelease += branch.currentRelease[0].newCurrentRelease;
                noOfReCurrentRelease += branch.currentRelease[0].reCurrentRelease;
                currentReleaseAmount += branch.currentRelease[0].currentReleaseAmount;

                if (newReleasePerson > 0 && collection.activeClients === '-') {
                    collection.allNew = true;
                    noOfClients += newReleasePerson;
                }
            }

            if (branch.fullPayment.length > 0) {
                collection.noOfFullPayment = branch.fullPayment[0].noOfFullPayment;
                collection.fullPaymentAmountStr = formatPricePhp(branch.fullPayment[0].fullPaymentAmount);

                fullPaymentAmount += branch.fullPayment[0].fullPaymentAmount;
                noOfFullPayment += branch.fullPayment[0].noOfFullPayment;
            }

            targetLoanCollection += collection.loanTarget ? collection.loanTarget : 0;
        } else {
            if (branch.cashCollections.length > 0) {
                collection.activeClients = branch.cashCollections[0].activeClients; 
                collection.activeBorrowers = branch.cashCollections[0].activeBorrowers;
                collection.pendingClients = branch.cashCollections[0].pendingClients;

                collection.totalReleases = branch.cashCollections[0].totalRelease;
                collection.totalReleasesStr = collection.totalReleases > 0 ? formatPricePhp(collection.totalReleases) : '-';
                collection.totalLoanBalance = branch.cashCollections[0].totalLoanBalance;
                collection.totalLoanBalanceStr = collection.totalLoanBalance > 0 ? formatPricePhp(collection.totalLoanBalance) : '-';
                collection.loanTarget = branch.cashCollections[0].loanTarget;
                collection.loanTargetStr = branch.cashCollections[0].loanTarget > 0 ? formatPricePhp(branch.cashCollections[0].loanTarget) : '-';
                
                collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                collection.total = branch.cashCollections[0].collection;
                collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                collection.mispaymentStr = branch.cashCollections[0].mispayment;
                collection.pastDue = branch.cashCollections[0].pastDue ? branch.cashCollections[0].pastDue : 0;
                collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                collection.noPastDue = branch.cashCollections[0].noPastDue ? branch.cashCollections[0].noPastDue : 0;

                collection.mcbu = branch.cashCollections[0].mcbu ? branch.cashCollections[0].mcbu: 0;
                collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu): '-';
                collection.mcbuCol = branch.cashCollections[0].mcbuCol ? branch.cashCollections[0].mcbuCol: 0;
                collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol): '-';
                collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal ? branch.cashCollections[0].mcbuWithdrawal: 0;
                collection.mcbuWithdrawalStr = collection.mcbuWithdrawal > 0 ? formatPricePhp(collection.mcbuWithdrawal): '-';
                collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo ? branch.cashCollections[0].mcbuReturnNo: 0;
                collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt ? branch.cashCollections[0].mcbuReturnAmt: 0;
                collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt): '-';
                // collection.mcbuDailyWithdrawal = branch.cashCollections[0].mcbuDailyWithdrawal;
                // collection.mcbuDailyWithdrawalStr = collection.mcbuDailyWithdrawal ? formatPricePhp(collection.mcbuDailyWithdrawal) : '-';

                const newReleasePerson = branch.cashCollections[0].newCurrentRelease;
                const reReleasePerson = branch.cashCollections[0].reCurrentRelease;
                collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                collection.currentReleaseAmountStr = formatPricePhp(branch.cashCollections[0].currentReleaseAmount);

                collection.noOfFullPayment = branch.cashCollections[0].noOfFullPayment;
                collection.fullPaymentAmountStr = formatPricePhp(branch.cashCollections[0].fullPaymentAmount);
                collection.status = groupStatus;

                collection.transfer = 0;
                collection.transferStr = '-';

                noOfClients += branch.cashCollections[0].activeClients;
                noOfBorrowers += branch.cashCollections[0].activeBorrowers;
                noOfPendings += branch.cashCollections[0].pendingClients;
                totalsLoanRelease += branch.cashCollections[0].totalRelease;
                totalsLoanBalance += branch.cashCollections[0].totalLoanBalance;
                targetLoanCollection += branch.cashCollections[0].loanTarget ? branch.cashCollections[0].loanTarget : 0;
                excess += branch.cashCollections[0].excess;
                totalLoanCollection += branch.cashCollections[0].collection;
                mispayment += branch.cashCollections[0].mispayment;
                totalPastDue += collection.pastDue;
                totalNoPastDue += collection.noPastDue;
                noOfNewCurrentRelease += branch.cashCollections[0].newCurrentRelease;
                noOfReCurrentRelease += branch.cashCollections[0].reCurrentRelease;
                currentReleaseAmount += branch.cashCollections[0].currentReleaseAmount;
                fullPaymentAmount += branch.cashCollections[0].fullPaymentAmount;
                noOfFullPayment += branch.cashCollections[0].noOfFullPayment;
                // totalMcbu += collection.mcbu ? collection.mcbu : 0;
                // totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                // totalMcbuDailyWithdrawal += collection.mcbuDailyWithdrawal ? collection.mcbuDailyWithdrawal : 0;
                totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
            }
        }

        if (branch.cashOnHand.length > 0) {
            collection.coh = branch.cashOnHand[0].amount ? branch.cashOnHand[0].amount : 0;
            collection.cohStr = collection.coh > 0 ? formatPricePhp(collection.coh) : '-';

            totalCOH += collection.coh;
        }

        if (branch.transferDailyGiverDetails.length > 0 || branch.transferDailyReceivedDetails.length > 0 || branch.transferWeeklyGiverDetails.length > 0 || branch.transferWeeklyReceivedDetails.length > 0) {
            let transfer = 0;
            let totalTransferMcbu = 0;
            let totalTransferTargetCollection = 0;
            let totalTransferActualCollection = 0;

            if (branch.transferDailyGiverDetails.length > 0) {
                collectionDailyReceived.push.apply(collectionDailyReceived, branch.transferDailyGiverDetails);
                transfer = transfer - branch.transferDailyGiverDetails.length;

                branch.transferDailyGiverDetails.map(giver => {    
                    if (filter) {
                        collection.activeClients -= 1;
                        noOfClients -= 1;
                        if (giver.status !== "completed") {
                            collection.activeBorrowers -= 1;
                            noOfBorrowers -= 1;
                        }
                    }

                    collection.mcbu -= giver.mcbu;
                    totalTransferMcbu -= giver.mcbu;

                    const details = giver.data[0];
                    const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                    totalTransferTargetCollection -= actualCollection;
                    totalTransferActualCollection -= actualCollection;

                    collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                    collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                    collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                    totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                });
            }

            if (branch.transferDailyReceivedDetails.length > 0) {
                collectionDailyTransferred.push.apply(collectionDailyTransferred, branch.transferDailyReceivedDetails);
                transfer = transfer + branch.transferDailyReceivedDetails.length;
                
                branch.transferDailyReceivedDetails.map(rcv => {
                    totalTransferMcbu += rcv.mcbu;
                    const details = rcv.data[0];
                    const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                    totalTransferTargetCollection += actualCollection;
                    totalTransferActualCollection += actualCollection;

                    if (!filter) {
                        if (rcv.status !== 'pending') {
                            collection.activeClients += 1;
                            noOfClients += 1;
                            if (rcv.status !== "completed") {
                                collection.activeBorrowers += 1;
                                noOfBorrowers += 1;
                            }
                            collection.mcbu += rcv.mcbu ? rcv.mcbu : 0;

                            collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                            collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                            collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                            collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                            totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                            totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                        }
                    } else {
                        if (rcv.status !== 'pending') {
                            collection.loanTarget -= rcv.targetCollection;
                            collection.loanTargetStr = formatPricePhp(collection.loanTarget);

                            if (rcv.status == 'tomorrow') {
                                collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }
    
                            targetLoanCollection -= rcv.targetCollection;
                        }
                    }
                });
            }

            if (branch.transferWeeklyGiverDetails.length > 0) {
                collectionWeeklyReceived.push.apply(collectionWeeklyReceived, branch.transferWeeklyGiverDetails);
                transfer = transfer - branch.transferWeeklyGiverDetails.length;

                branch.transferWeeklyGiverDetails.map(giver => {
                    if (filter) {
                        collection.activeClients -= 1;
                        noOfClients -= 1;
                        if (giver.status !== "completed") {
                            collection.activeBorrowers -= 1;
                            noOfBorrowers -= 1;
                        }
                    }
                    collection.mcbu -= giver.mcbu;
                    totalTransferMcbu -= giver.mcbu;

                    const details = giver.data[0];
                    const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                    totalTransferTargetCollection -= actualCollection;
                    totalTransferActualCollection -= actualCollection;

                    collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                    collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                    collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                    totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                });
            }
            
            if (branch.transferWeeklyReceivedDetails.length > 0) {
                collectionWeeklyTransferred.push.apply(collectionWeeklyTransferred, branch.transferWeeklyReceivedDetails);
                transfer = transfer + branch.transferWeeklyReceivedDetails.length;

                branch.transferWeeklyReceivedDetails.map(rcv => {
                    totalTransferMcbu += rcv.mcbu;
                    const details = rcv.data[0];
                    const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                    totalTransferTargetCollection += actualCollection;
                    totalTransferActualCollection += actualCollection;
                    if (!filter) {
                        if (rcv.status !== 'pending') {
                            collection.activeClients += 1;
                            noOfClients += 1;
                            if (rcv.status !== "completed") {
                                collection.activeBorrowers += 1;
                                noOfBorrowers += 1;
                            }
                            collection.mcbu += rcv.mcbu ? rcv.mcbu : 0;

                            collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                            collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                            collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                            collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                            totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                            totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                        }
                    } else {
                        if (rcv.status !== 'pending') {
                            collection.loanTarget -= rcv.targetCollection;
                            collection.loanTargetStr = formatPricePhp(collection.loanTarget);

                            if (rcv.status == 'tomorrow') {
                                collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }
    
                            targetLoanCollection -= rcv.targetCollection;
                        }
                    }
                });
            }

            if (branch.transferDailyReceivedDetails.length > 0 || branch.transferDailyGiverDetails.length > 0 || branch.transferWeeklyReceivedDetails.length > 0 || branch.transferWeeklyGiverDetails.length > 0) {
                collection.mcbuStr = formatPricePhp(collection.mcbu);
                collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
                collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);
                collection.mcbuCol += totalTransferMcbu;
                collection.mcbuColStr = formatPricePhp(collection.mcbuCol);
                collection.loanTarget += totalTransferTargetCollection;
                collection.loanTargetStr = formatPricePhp(collection.loanTarget);
                collection.total += totalTransferActualCollection;
                collection.totalStr = formatPricePhp(collection.total);

                collection.activeClients = collection.activeClients > -1 ? collection.activeClients : 0;
                collection.activeBorrowers = collection.activeBorrowers > -1 ? collection.activeBorrowers : 0;
            }

            collection.transfer = transfer;
            collection.transferStr = transfer >= 0 ? transfer : `(${transfer * -1})`;
            totalTransfer += transfer;
        }

        collectionData.push(collection);
    });

    collectionData.map(c => {
        totalMcbu += c.mcbu ? c.mcbu : 0;
        totalMcbuCol += c.mcbuCol ? c.mcbuCol : 0;
    });

    const transferGvr = transferBranchDetailsTotal(collectionDailyTransferred, collectionWeeklyTransferred, 'Transfer GVR');
    const transferRcv = transferBranchDetailsTotal(collectionDailyReceived, collectionWeeklyReceived, 'Transfer RCV');
    if (collectionDailyTransferred.length > 0 || collectionWeeklyTransferred.length > 0) {
        collectionData.push(transferGvr);
    }
    if (collectionDailyReceived.length > 0 || collectionWeeklyReceived.length > 0) {
        collectionData.push(transferRcv);
    }

    const branchTotals = {
        name: 'GRAND TOTALS',
        transfer: totalTransfer,
        noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
        currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
        activeClients: noOfClients,
        activeBorrowers: noOfBorrowers,
        pendingClients: noOfPendings,
        totalReleasesStr: formatPricePhp(totalsLoanRelease),
        totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
        loanTargetStr: targetLoanCollection > 0 ? formatPricePhp(targetLoanCollection) : 0,
        excessStr: formatPricePhp(excess),
        totalStr: formatPricePhp(totalLoanCollection),
        mispaymentStr: mispayment + ' / ' + noOfClients,
        fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
        noOfFullPayment: noOfFullPayment,
        pastDueStr: formatPricePhp(totalPastDue),
        noPastDue: totalNoPastDue,
        mcbu: totalMcbu,
        mcbuStr: formatPricePhp(totalMcbu),
        mcbuCol: totalMcbuCol,
        mcbuColStr: formatPricePhp(totalMcbuCol),
        mcbuWithdrawal: totalMcbuWithdrawal,
        mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
        // mcbuDailyWithdrawal: totalMcbuDailyWithdrawal,
        // mcbuDailyWithdrawalStr: formatPricePhp(totalMcbuDailyWithdrawal),
        noMcbuReturn: totalMcbuReturnNo,
        mcbuReturnAmt: totalMcbuReturnAmt,
        mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
        coh: totalCOH,
        cohStr: formatPricePhp(totalCOH),
        totalData: true
    };

    collectionData.push(branchTotals);

    return collectionData;
}