import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    let data;

    const { remarks, occurence, date, startDate, endDate, branchId, loId, groupId } = req.query;

    if (remarks === 'pending') {
        data = await getPendingRemarks(date, startDate, endDate, branchId, loId, groupId, occurence);
    } else {
        if (date) {
            if (branchId && loId === 'undefined' && groupId === 'undefined') {
                data = await db
                    .collection('cashCollections')
                    .aggregate([
                        { $match: { "remarks.value": remarks, occurence: occurence, dateAdded: date, branchId: branchId } },
                        {
                            $addFields: {
                                "branchIdObj": { $toObjectId: "$branchId" },
                                "groupIdObj": { $toObjectId: "$groupId" },
                                "clientIdObj": { $toObjectId: "$clientId" },
                                "loanIdObj": { $toObjectId: "$loanId" },
                            }
                        },
                        {
                            $lookup: {
                                from: "branches",
                                localField: "branchIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name', code: '$code' } }
                                ],
                                as: "branch"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "groupIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name' } }
                                ],
                                as: "group"
                            }
                        },
                        {
                            $lookup: {
                                from: "client",
                                localField: "clientIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                                ],
                                as: "client"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "loanIdObj",
                                foreignField: "_id",
                                as: "loan"
                            }
                        },
                        { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                    ])
                    .toArray(); 
            } else if (branchId && loId && groupId === 'undefined') {
                data = await db
                    .collection('cashCollections')
                    .aggregate([
                        { $match: { "remarks.value": remarks, occurence: occurence, dateAdded: date, branchId: branchId, loId: loId } },
                        {
                            $addFields: {
                                "branchIdObj": { $toObjectId: "$branchId" },
                                "groupIdObj": { $toObjectId: "$groupId" },
                                "clientIdObj": { $toObjectId: "$clientId" },
                                "loanIdObj": { $toObjectId: "$loanId" },
                            }
                        },
                        {
                            $lookup: {
                                from: "branches",
                                localField: "branchIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name', code: '$code' } }
                                ],
                                as: "branch"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "groupIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name' } }
                                ],
                                as: "group"
                            }
                        },
                        {
                            $lookup: {
                                from: "client",
                                localField: "clientIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                                ],
                                as: "client"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "loanIdObj",
                                foreignField: "_id",
                                as: "loan"
                            }
                        },
                        { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                    ])
                    .toArray(); 
            } else if (branchId && loId && groupId) {
                data = await db
                    .collection('cashCollections')
                    .aggregate([
                        { $match: { "remarks.value": remarks, occurence: occurence, dateAdded: date, branchId: branchId, loId: loId, groupId: groupId } },
                        {
                            $addFields: {
                                "branchIdObj": { $toObjectId: "$branchId" },
                                "groupIdObj": { $toObjectId: "$groupId" },
                                "clientIdObj": { $toObjectId: "$clientId" },
                                "loanIdObj": { $toObjectId: "$loanId" },
                            }
                        },
                        {
                            $lookup: {
                                from: "branches",
                                localField: "branchIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name', code: '$code' } }
                                ],
                                as: "branch"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "groupIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name' } }
                                ],
                                as: "group"
                            }
                        },
                        {
                            $lookup: {
                                from: "client",
                                localField: "clientIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                                ],
                                as: "client"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "loanIdObj",
                                foreignField: "_id",
                                as: "loan"
                            }
                        },
                        { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                    ])
                    .toArray(); 
            }
        } else if (startDate && endDate) {
            if (branchId && loId === 'undefined' && groupId === 'undefined') {
                data = await db
                    .collection('cashCollections')
                    .aggregate([
                        { $match: { $expr: {
                            $and: [
                                {$eq: ['$remarks.value', remarks]},
                                {$eq: ['$occurence', occurence]},
                                {$eq: ['$branchId', branchId]},
                                {$gte: ['$dateAdded', startDate]}, {$lte: ['$dateAdded', endDate]}
                            ]
                        } } },
                        {
                            $addFields: {
                                "branchIdObj": { $toObjectId: "$branchId" },
                                "groupIdObj": { $toObjectId: "$groupId" },
                                "clientIdObj": { $toObjectId: "$clientId" },
                                "loanIdObj": { $toObjectId: "$loanId" },
                            }
                        },
                        {
                            $lookup: {
                                from: "branches",
                                localField: "branchIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name', code: '$code' } }
                                ],
                                as: "branch"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "groupIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name' } }
                                ],
                                as: "group"
                            }
                        },
                        {
                            $lookup: {
                                from: "client",
                                localField: "clientIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                                ],
                                as: "client"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "loanIdObj",
                                foreignField: "_id",
                                as: "loan"
                            }
                        },
                        { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                    ])
                    .toArray(); 
            } else if (branchId && loId && groupId === 'undefined') {
                data = await db
                    .collection('cashCollections')
                    .aggregate([
                        { $match: { $expr: {
                            $and: [
                                {$eq: ['$remarks.value', remarks]},
                                {$eq: ['$occurence', occurence]},
                                {$eq: ['$branchId', branchId]},
                                {$eq: ['$loId', loId]},
                                {$gte: ['$dateAdded', startDate]}, {$lte: ['$dateAdded', endDate]}
                            ]
                        } } },
                        {
                            $addFields: {
                                "branchIdObj": { $toObjectId: "$branchId" },
                                "groupIdObj": { $toObjectId: "$groupId" },
                                "clientIdObj": { $toObjectId: "$clientId" },
                                "loanIdObj": { $toObjectId: "$loanId" },
                            }
                        },
                        {
                            $lookup: {
                                from: "branches",
                                localField: "branchIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name', code: '$code' } }
                                ],
                                as: "branch"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "groupIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name' } }
                                ],
                                as: "group"
                            }
                        },
                        {
                            $lookup: {
                                from: "client",
                                localField: "clientIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                                ],
                                as: "client"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "loanIdObj",
                                foreignField: "_id",
                                as: "loan"
                            }
                        },
                        { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                    ])
                    .toArray(); 
            } else if (branchId && loId && groupId) {
                data = await db
                    .collection('cashCollections')
                    .aggregate([
                        { $match: { $expr: {
                            $and: [
                                {$eq: ['$remarks.value', remarks]},
                                {$eq: ['$occurence', occurence]},
                                {$eq: ['$branchId', branchId]},
                                {$eq: ['$loId', loId]},
                                {$eq: ['$groupId', groupId]},
                                {$gte: ['$dateAdded', startDate]}, {$lte: ['$dateAdded', endDate]}
                            ]
                        } } },
                        {
                            $addFields: {
                                "branchIdObj": { $toObjectId: "$branchId" },
                                "groupIdObj": { $toObjectId: "$groupId" },
                                "clientIdObj": { $toObjectId: "$clientId" },
                                "loanIdObj": { $toObjectId: "$loanId" },
                            }
                        },
                        {
                            $lookup: {
                                from: "branches",
                                localField: "branchIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name', code: '$code' } }
                                ],
                                as: "branch"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "groupIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { name: '$name' } }
                                ],
                                as: "group"
                            }
                        },
                        {
                            $lookup: {
                                from: "client",
                                localField: "clientIdObj",
                                foreignField: "_id",
                                pipeline: [
                                    { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                                ],
                                as: "client"
                            }
                        },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "loanIdObj",
                                foreignField: "_id",
                                as: "loan"
                            }
                        },
                        { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                    ])
                    .toArray(); 
            }
        }
    }
    
    response = {
        success: true,
        data: data
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


const getPendingRemarks = async (date, startDate, endDate, branchId, loId, groupId, occurence) => {
    const { db } = await connectToDatabase();
    let data;

    if (date) {
        if (branchId && loId === 'undefined' && groupId === 'undefined') {
            data = await db
                .collection('cashCollections')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            { $eq: ['$occurence', occurence] },
                            { $eq: ['$dateAdded', date] },
                            { $eq: ['$branchId', branchId] },
                            { $regexMatch: { input: '$remarks.value', regex: /^reloaner/ } },
                            { $eq: ['$status', 'completed'] }
                        ]
                    } } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loanIdObj": { $toObjectId: "$loanId" },
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "branchIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name', code: '$code' } }
                            ],
                            as: "branch"
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name' } }
                            ],
                            as: "group"
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loanIdObj",
                            foreignField: "_id",
                            as: "loan"
                        }
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                ])
                .toArray(); 
        } else if (branchId && loId && groupId === 'undefined') {
            data = await db
                .collection('cashCollections')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            { $eq: ['$occurence', occurence] },
                            { $eq: ['$dateAdded', date] },
                            { $eq: ['$branchId', branchId] },
                            { $eq: ['$loId', loId] },
                            { $regexMatch: { input: '$remarks.value', regex: /^reloaner/ } },
                            { $eq: ['$status', 'completed'] }
                        ]
                    } } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loanIdObj": { $toObjectId: "$loanId" },
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "branchIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name', code: '$code' } }
                            ],
                            as: "branch"
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name' } }
                            ],
                            as: "group"
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loanIdObj",
                            foreignField: "_id",
                            as: "loan"
                        }
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                ])
                .toArray(); 
        } else if (branchId && loId && groupId) {
            data = await db
                .collection('cashCollections')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            { $eq: ['$occurence', occurence] },
                            { $eq: ['$dateAdded', date] },
                            { $eq: ['$branchId', branchId] },
                            { $eq: ['$loId', loId] },
                            { $eq: ['$groupId', groupId] },
                            { $regexMatch: { input: '$remarks.value', regex: /^reloaner/ } },
                            { $eq: ['$status', 'completed'] }
                        ]
                    } } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loanIdObj": { $toObjectId: "$loanId" },
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "branchIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name', code: '$code' } }
                            ],
                            as: "branch"
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name' } }
                            ],
                            as: "group"
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loanIdObj",
                            foreignField: "_id",
                            as: "loan"
                        }
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                ])
                .toArray(); 
        }
    } else if (startDate && endDate) {
        if (branchId && loId === 'undefined' && groupId === 'undefined') {
            data = await db
                .collection('cashCollections')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {$eq: ['$occurence', occurence]},
                            {$eq: ['$branchId', branchId]},
                            {$gte: ['$dateAdded', startDate]}, {$lte: ['$dateAdded', endDate]},
                            { $regexMatch: { input: '$remarks.value', regex: /^reloaner/ } },
                            { $eq: ['$status', 'completed'] }
                        ]
                    } } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loanIdObj": { $toObjectId: "$loanId" },
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "branchIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name', code: '$code' } }
                            ],
                            as: "branch"
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name' } }
                            ],
                            as: "group"
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loanIdObj",
                            foreignField: "_id",
                            as: "loan"
                        }
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                ])
                .toArray(); 
        } else if (branchId && loId && groupId === 'undefined') {
            data = await db
                .collection('cashCollections')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {$eq: ['$occurence', occurence]},
                            {$eq: ['$branchId', branchId]},
                            {$eq: ['$loId', loId]},
                            {$gte: ['$dateAdded', startDate]}, {$lte: ['$dateAdded', endDate]},
                            { $regexMatch: { input: '$remarks.value', regex: /^reloaner/ } },
                            { $eq: ['$status', 'completed'] }
                        ]
                    } } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loanIdObj": { $toObjectId: "$loanId" },
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "branchIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name', code: '$code' } }
                            ],
                            as: "branch"
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name' } }
                            ],
                            as: "group"
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loanIdObj",
                            foreignField: "_id",
                            as: "loan"
                        }
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                ])
                .toArray(); 
        } else if (branchId && loId && groupId) {
            data = await db
                .collection('cashCollections')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {$eq: ['$occurence', occurence]},
                            {$eq: ['$branchId', branchId]},
                            {$eq: ['$loId', loId]},
                            {$eq: ['$groupId', groupId]},
                            {$gte: ['$dateAdded', startDate]}, {$lte: ['$dateAdded', endDate]},
                            { $regexMatch: { input: '$remarks.value', regex: /^reloaner/ } },
                            { $eq: ['$status', 'completed'] }
                        ]
                    } } },
                    {
                        $addFields: {
                            "branchIdObj": { $toObjectId: "$branchId" },
                            "groupIdObj": { $toObjectId: "$groupId" },
                            "clientIdObj": { $toObjectId: "$clientId" },
                            "loanIdObj": { $toObjectId: "$loanId" },
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "branchIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name', code: '$code' } }
                            ],
                            as: "branch"
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: "groupIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { name: '$name' } }
                            ],
                            as: "group"
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $project: { firstName: '$firstName', lastName: '$lastName', status: '$status', delinquent: '$delinquent' } }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "loanIdObj",
                            foreignField: "_id",
                            as: "loan"
                        }
                    },
                    { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0, loanIdObj: 0 } }
                ])
                .toArray(); 
        }
    }

    return data;
}