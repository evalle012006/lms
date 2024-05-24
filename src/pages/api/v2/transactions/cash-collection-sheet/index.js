import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { date, userId, branchId } = req.query;
    let statusCode = 200;
    let response = {};
    let data;
    
    if (userId) {
        data = await db.collection('users')
                    .aggregate([
                        { $match: {_id: new ObjectId(userId)} },
                        {
                            $lookup: {
                                from: 'groups',
                                localField: userId,
                                foreignField: 'loId',
                                pipeline: [
                                    {
                                        $addFields: {
                                            "groupIdStr": { $toString: "$_id" }
                                        }
                                    },
                                    {
                                        $lookup: {
                                            from: 'cashCollections',
                                            let: { groupName: '$name' },
                                            localField: '$groupIdStr',
                                            foreignField: 'groupId',
                                            pipeline: [
                                                {
                                                    $match: { dateAdded: date }
                                                },
                                                {
                                                    $group: {
                                                        _id: '$$groupName',
                                                        groupStatusArr: { $addToSet: '$groupStatus' },
                                                        mcbuColTarget: { $sum: { $cond: {
                                                            if: {$eq: ['$occurence', 'daily']},
                                                            then: 10,
                                                            else: 50
                                                        } } },
                                                        mcbuColActual: { $sum: 'mcbuCol' },
                                                        loanTarget: { $sum: '$activeLoan' },
                                                        excess: { $sum: '$excess' },
                                                        actual: { $sum: '$paymentCollection' },
                                                        mcbuWithdrawal: { $sum: '$mcbuWithdrawal' },
                                                        mcbuNoReturn: { $sum: { $cond: {
                                                            if: {$gt: ['$mcbuReturnAmt', 0]},
                                                            then: 1,
                                                            else: 0
                                                        } } },
                                                        mcbuReturnAmount: { $sum: '$mcbuReturnAmt' }
                                                    }
                                                }
                                            ],
                                            as: 'collections'
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
                                ],
                                as: 'groups'
                            }
                        }
                    ])
                    .toArray();
    } else if (branchId) {
        // for bm
    }
    
        
    response = { success: true, data: data };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}