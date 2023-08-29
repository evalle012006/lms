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

    const { branchId, loId, startDate, endDate, occurence } = req.query;

    let transfers;

    if (loId) {

    } else {
        transfers = await db
            .collection('users')
            .aggregate([
                { $match: { "role.rep": 4, designatedBranchId: branchId } },
                { $addFields: { loIdStr: { $toString: '$_id' } } },
                {
                    $lookup: {
                        from: 'transferClients',
                        localField: 'loIdStr',
                        foreignField: 'sourceUserId',
                        pipeline: [
                            { $match: {$expr: { $and: [
                                {$eq: ['$loToLo', true] }, {$eq: ['$sameLo', false] }, {$eq: ['$branchToBranch', false] },
                                {$gte: ['$approveRejectDate', startDate]}, {$lte: ['$approveRejectDate', endDate]}, 
                                {$eq: ['$occurence', occurence]}
                            ]}} },
                            { 
                                $addFields: { 
                                    transferIdStr: { $toString: "$_id" },
                                    receiverIdObj: { $toObjectId: "$targetUserId" }
                                } 
                            },
                            {
                                $lookup: {
                                    from: "users",
                                    localField: "receiverIdObj",
                                    foreignField: "_id",
                                    pipeline: [ { $project: { password: 0, role: 0, logged: 0 } } ],
                                    as: "receiver"
                                }
                            },
                            {
                                $lookup: {
                                    from: "cashCollections",
                                    localField: "transferIdStr",
                                    foreignField: "transferId",
                                    pipeline: [
                                        { $match: { transferred: true } },
                                        {
                                            $group: {
                                                _id: '$loId',
                                                activeClients: { $sum: 1 },
                                                mcbu: { $sum: '$mcbu' },
                                                activeLoanBalance: { $sum: '$amountRelease' },
                                                actualCollection: { $sum: { $subtract: ['$amountRelease', '$loanBalance'] } },
                                                loanBalance: { $sum: '$loanBalance' },
                                                noPastDue: { $sum: { $cond: {
                                                    if: { $gt: ['$pastDue', 0] },
                                                    then: 1,
                                                    else: 0
                                                } } },
                                                pastDue: { $sum: '$pastDue' }
                                            }
                                        }
                                    ],
                                    as: "details"
                                }
                            }
                        ],
                        as: 'giverDetails'
                    }
                },
                {
                    $lookup: {
                        from: 'transferClients',
                        localField: 'loIdStr',
                        foreignField: 'targetUserId',
                        pipeline: [
                            { $match: {$expr: { $and: [
                                {$eq: ['$loToLo', true] }, {$eq: ['$sameLo', false] }, {$eq: ['$branchToBranch', false] },
                                {$gte: ['$approveRejectDate', startDate]}, {$lte: ['$approveRejectDate', endDate]}, 
                                {$eq: ['$occurence', occurence]}
                            ]}} },
                            { 
                                $addFields: { 
                                    transferIdStr: { $toString: "$_id" },
                                    giverIdObj: { $toObjectId: "$sourceUserId" }
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
                            {
                                $lookup: {
                                    from: "cashCollections",
                                    localField: "transferIdStr",
                                    foreignField: "transferId",
                                    pipeline: [
                                        { $match: { transfer: true } },
                                        {
                                            $group: {
                                                _id: '$loId',
                                                activeClients: { $sum: 1 },
                                                mcbu: { $sum: '$mcbu' },
                                                activeLoanBalance: { $sum: '$amountRelease' },
                                                actualCollection: { $sum: { $subtract: ['$amountRelease', '$loanBalance'] } },
                                                loanBalance: { $sum: '$loanBalance' },
                                                noPastDue: { $sum: { $cond: {
                                                    if: { $gt: ['$pastDue', 0] },
                                                    then: 1,
                                                    else: 0
                                                } } },
                                                pastDue: { $sum: '$pastDue' }
                                            }
                                        }
                                    ],
                                    as: "details"
                                }
                            }
                        ],
                        as: 'receiverDetails'
                    }
                },
                { $project: { loIdStr: 0, password: 0, role: 0, logged: 0 } }
            ])
            .toArray();
    }

    response = {
        success: true,
        data: transfers
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
