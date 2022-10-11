import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';


export default apiHandler({
    get: getLoanWithCashCollection
});

async function getLoanWithCashCollection(req, res) {
    const { db } = await connectToDatabase();

    const { date, mode, branchId, loId, groupId } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;


    if (branchId) {
        cashCollection = await db
            .collection('loans')
            .aggregate([
                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                { $match: {$expr: { $and: [ { $or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}] },
                     {$eq: ['$branchId', branchId]}, {$lte: ['$startDateObj', '$currentDateObj']}
                ]}} },
                // { $match: { branchId: branchId, status: 'active' } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loanIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: "current"
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { mode: mode } },
                            { $group: { 
                                    _id: '$clientId',
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
                                } 
                            }
                        ],
                        as: "history"
                    }
                },
                { $project: { clientIdObj: 0, loanIdStr: 0 } }
            ])
            .toArray();
    } else if (loId) {
        cashCollection = await db
            .collection('loans')
            .aggregate([
                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                { $match: {$expr: { $and: [ { $or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}] },
                     {$lte: ['$startDateObj', '$currentDateObj']}
                ]}} },
                // { $match: { status: 'active' } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loanIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: "current"
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { loId: loId, mode: mode } },
                            { $group: { 
                                    _id: '$clientId',
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
                                } 
                            }
                        ],
                        as: "history"
                    }
                },
                { $project: { clientIdObj: 0, loanIdStr: 0 } }
            ])
            .toArray();
    } else if (groupId) {
        cashCollection = await db
            .collection('loans')
            .aggregate([
                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                // { $match: { groupId: groupId, status: 'active',  } },
                { $match: {$expr: { $and: [
                    {$eq: ['$groupId', groupId]}, {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}, {$lte: ['$startDateObj', '$currentDateObj']}
                ]}} },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loanIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: "current"
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { mode: mode } },
                            { $group: { 
                                    _id: '$clientId',
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
                                } 
                            }
                        ],
                        as: "history"
                    }
                },
                { $project: { clientIdObj: 0, loanIdStr: 0 } }
            ])
            .toArray();
    } else {
        cashCollection = await db
            .collection('loans')
            .aggregate([
                { $addFields: { 'startDateObj': {$dateFromString: { dateString: '$startDate', format:"%Y-%m-%d" }}, 'currentDateObj': {$dateFromString: { dateString: date, format:"%Y-%m-%d" }} } },
                { $match: {$expr: { $and: [ { $or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}] },
                     {$lte: ['$startDateObj', '$currentDateObj']}
                ]}} },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "loanIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: "current"
                    }
                },
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "loanIdStr",
                        foreignField: "loanId",
                        pipeline: [
                            { $match: { mode: mode } },
                            { $group: { 
                                    _id: '$clientId',
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
                                } 
                            }
                        ],
                        as: "history"
                    }
                },
                { $project: { clientIdObj: 0, loanIdStr: 0 } }
            ])
            .toArray();
    }

        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}