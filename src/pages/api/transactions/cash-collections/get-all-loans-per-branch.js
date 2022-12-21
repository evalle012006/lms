import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';


export default apiHandler({
    get: getAllLoansPerGroup
});

async function getAllLoansPerGroup(req, res) {
    const { db } = await connectToDatabase();

    const { date, mode } = req.query;
    let statusCode = 200;
    let response = {};
    const cashCollection = await db
            .collection('branches')
            .aggregate([
                {
                    $lookup: {
                        from: "users",
                        let: { branchCode: "$code" },
                        pipeline: [
                            { $match: { $expr: { $ne: ["$role.rep", 1] } } },
                            {
                                $project: {
                                    branchCodes: {
                                        $cond: {
                                        "if": { $isArray: ["$designatedBranch"]},
                                        "then": "$designatedBranch",
                                        "else": {$split: ["$designatedBranch", " "]}
                                        }
                                    }
                                }
                              },
                            { $match: { $expr: {$in: ["$$branchCode", "$branchCodes"]} } },
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
                                                            mispayment: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                                            loanTarget: { $sum: '$activeLoan' },
                                                            collection: { $sum: '$paymentCollection' },
                                                            excess: { $sum: '$excess' },
                                                            total: { $sum: '$total' }
                                                    } }
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
                                                        {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'pending']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
                                                    ]}} },
                                                    { $group: { 
                                                            _id: '$$groupName',
                                                            activeClients: { $sum: { $cond:{if: { $ne: ['$status', 'pending']}, then: 1, else: 0} } },
                                                            activeBorrowers: { $sum: { $cond:{if: { $and: [{$ne: ['$status', 'pending']}, {$gt: ['$loanBalance', 0]}] }, then: 1, else: 0} } },
                                                            mispayment: { $sum: { $cond:{if: { $ne: ['$status', 'pending']}, then: '$mispayment', else: 0} } },
                                                            totalRelease: { $sum: { $cond:{if: { $ne: ['$status', 'pending']}, then: '$amountRelease', else: 0} } },
                                                            totalLoanBalance: { $sum: { $cond:{if: { $ne: ['$status', 'pending']}, then: '$loanBalance', else: 0} } },
                                                            loanTarget: { $sum: { $cond:{if: { $ne: ['$status', 'pending']}, then: '$activeLoan', else: 0} } },
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
                                        { $project: { groupIdStr: 0, availableSlots: 0 } }
                                    ],
                                    as: "groups"
                                }
                            },
                            { $project: { password: 0, profile: 0, role: 0, branchCodes: 0, loIdStr: 0 } }
                        ],
                        as: "users"
                    }
                }
            ])
            .toArray();

        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}