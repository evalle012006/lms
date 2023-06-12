import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { branchId, startDate, endDate, occurence } = req.query;

    const transfers = await db
        .collection('transferClients')
        .aggregate([
            { $match: {$expr: { $and: [
                {$gte: ['$approveRejectDate', startDate]}, {$lte: ['$approveRejectDate', endDate]}, 
                {$eq: ['$sourceBranchId', branchId]}, {$eq: ['$sameLo', false]}, {$eq: ['$occurence', occurence]}
            ]}} },
            {
                $group: {
                    _id: {
                        giver: "$sourceUserId",
                        receiver: "$targetUserId"
                    }
                }
            },
            {
                $addFields: {
                    giverIdStr: { $toString: "$_id.giver" },
                    giverIdObj: { $toObjectId: "$_id.giver" },
                    receiverIdObj: { $toObjectId: "$_id.receiver" },
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "giverIdObj",
                    foreignField: "_id",
                    pipeline: [ { $project: { password: 0, role: 0, logged: 0 } } ],
                    as: "giver"
                }
            },
            { $unwind: '$giver' },
            {
                $lookup: {
                    from: "users",
                    localField: "receiverIdObj",
                    foreignField: "_id",
                    pipeline: [ { $project: { password: 0, role: 0, logged: 0 } } ],
                    as: "receiver"
                }
            },
            { $unwind: '$receiver' },
            {
                $lookup: {
                    from: "cashCollections",
                    localField: "giverIdStr",
                    foreignField: "loId",
                    pipeline: [
                        { $match: {$expr: { $and: [
                            {$gte: ['$dateAdded', startDate]}, {$lte: ['$dateAdded', endDate]}, {$eq: ['$transferred', true]},
                            {$eq: ['$branchId', branchId]}, {$eq: ['$sameLo', false]}, {$eq: ['$occurence', occurence]}
                        ]}} },
                        {
                            $group: {
                                _id: '$loId',
                                activeClients: { $sum: 1 },
                                mcbu: { $sum: '$mcbu' },
                                activeLoanBalance: { $sum: "$amountRelease" },
                                actualCollection: { $sum: { $subtract: ['$amountRelease', '$loanBalance'] } },
                                loanBalance: { $sum: "$loanBalance" },
                                noPastDue: { $sum: { $cond: {
                                    if: { $gt: ['$pastDue', 0] },
                                    then: 1,
                                    else: 0
                                } } },
                                pastDue: { $sum: "$pastDue" }
                            }
                        }
                    ],
                    as: "details"
                }
            },
            { $project: { giverIdStr: 0, giverIdObj: 0, receiverIdObj: 0 } }
        ])
        .toArray();

    response = {
        success: true,
        data: transfers
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
