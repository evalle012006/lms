import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';


export default apiHandler({
    get: getAllLoansPerGroup
});

async function getAllLoansPerGroup(req, res) {
    const { db } = await connectToDatabase();

    const { date, mode, branchId, loId, groupId } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;


    if (branchId) {
        cashCollection = await db
            .collection('groups')
            .aggregate([
                { $match: { branchId: branchId, occurence: mode } },
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
                            { $match: {dateAdded: date} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
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
                            { $match: {status: 'active'} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: 0 },
                                    mispayments: { $sum: '$mispayments' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
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
                            { $match: {dateAdded: date} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
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
                            { $match: {status: 'active'} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: 0 },
                                    mispayments: { $sum: '$mispayments' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
            ])
            .toArray();
    } else if (groupId) {
        cashCollection = await db
            .collection('groups')
            .aggregate([
                { $match: { groupId: groupId, occurence: mode } },
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
                            { $match: {dateAdded: date} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
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
                            { $match: {status: 'active'} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: 0 },
                                    mispayments: { $sum: '$mispayments' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
            ])
            .toArray();
    } else {
        cashCollection = await db
            .collection('groups')
            .aggregate([
                { $match: { occurence: mode } },
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
                            { $match: {dateAdded: date} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: { $cond: {if: { $gt: ['$paymentCollection', 0] }, then: 1, else: 0} } },
                                    mispayments: { $sum: { $cond:{if: { $eq: ['$mispayment', true] }, then: 1, else: 0} } },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: '$paymentCollection' },
                                    excess: { $sum: '$excess' },
                                    total: { $sum: '$paymentCollection' }
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
                            { $match: {status: 'active'} },
                            { $group: { 
                                    _id: '$$groupName',
                                    noOfClients: { $sum: 0 },
                                    mispayments: { $sum: '$mispayments' },
                                    loanTarget: { $sum: '$activeLoan' },
                                    collection: { $sum: 0 },
                                    excess: { $sum: 0 },
                                    total: { $sum: 0 }
                                } 
                            }
                        ],
                        as: "loans"
                    }
                },
                { $project: { groupIdStr: 0, availableSlots: 0 } }
            ])
            .toArray();
    }

        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}