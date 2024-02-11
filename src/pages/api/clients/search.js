import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    let clients;

    const { searchText, mode } = req.query;

    const strArr = searchText.split(' ');
    if (mode == 'offset') {
        if (strArr.length == 2) {
            clients = await db
                .collection('client')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {$eq: ['$firstName', strArr[0]]},
                            {$eq: ['$lastName', strArr[1]]},
                            {$eq: ['$status', "offset"]}
                        ]
                    }  } }
                ])
                .toArray();
        } else if (strArr.length == 3) {
            clients = await db
                .collection('client')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {$or: [
                                {$eq: ['$firstName', strArr[0]]},
                                {$eq: ['$firstName', `${strArr[1]} ${strArr[1]}`]},
                            ]},
                            {$eq: ['$middleName', strArr[1]]},
                            {$eq: ['$lastName', strArr[2]]},
                            {$eq: ['$status', "offset"]}
                        ]
                    }  } }
                ])
                .toArray();
        } else {
            clients = await db
                .collection('client')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {
                                $or: [
                                    {$regexMatch: {
                                        input: '$fullName',
                                        regex: `^${searchText}$`,
                                        options: 'm'
                                    }},
                                    {$regexMatch: {
                                        input: '$firstName',
                                        regex: `^${searchText}$`,
                                        options: 'm'
                                    }},
                                    {$regexMatch: {
                                        input: '$lastName',
                                        regex: `^${searchText}$`,
                                        options: 'm'
                                    }},
                                ]
                            },
                            {$eq: ['$status', "offset"]}
                        ]
                    }  } }
                ])
                .toArray();
        }
    } else {
        if (strArr.length == 2) {
            clients = await db
                .collection('client')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {$eq: ['$firstName', strArr[0]]},
                            {$eq: ['$lastName', strArr[1]]}
                        ]
                    }  } },
                    { $addFields: { 
                        branchIdObj: { $toObjectId: '$branchId' },
                        groupIdObj: { $toObjectId: '$groupId' },
                    } },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: 'groupIdObj',
                            foreignField: '_id',
                            pipeline: [
                                {
                                    $project: {
                                        name: '$name'
                                    }
                                }
                            ],
                            as: 'group'
                        }
                    },
                    { $unwind: '$group' },
                    {
                        $lookup: {
                            from: 'branches',
                            localField: 'branchIdObj',
                            foreignField: '_id',
                            pipeline: [
                                {
                                    $project: {
                                        name: '$name'
                                    }
                                }
                            ],
                            as: 'branch'
                        }
                    },
                    { $unwind: '$branch' }
                ])
                .toArray();
        } else if (strArr.length == 3) {
            clients = await db
                .collection('client')
                .aggregate([
                    { $match: { $expr: {
                        $and: [
                            {$or: [
                                {$eq: ['$firstName', strArr[0]]},
                                {$eq: ['$firstName', `${strArr[1]} ${strArr[1]}`]},
                            ]},
                            {$eq: ['$middleName', strArr[1]]},
                            {$eq: ['$lastName', strArr[2]]},
                        ]
                    }  } },
                    { $addFields: { 
                        branchIdObj: { $toObjectId: '$branchId' },
                        groupIdObj: { $toObjectId: '$groupId' },
                    } },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: 'groupIdObj',
                            foreignField: '_id',
                            pipeline: [
                                {
                                    $project: {
                                        name: '$name'
                                    }
                                }
                            ],
                            as: 'group'
                        }
                    },
                    { $unwind: '$group' },
                    {
                        $lookup: {
                            from: 'branches',
                            localField: 'branchIdObj',
                            foreignField: '_id',
                            pipeline: [
                                {
                                    $project: {
                                        name: '$name'
                                    }
                                }
                            ],
                            as: 'branch'
                        }
                    },
                    { $unwind: '$branch' }
                ])
                .toArray();
        } else {
            clients = await db
                .collection('client')
                .aggregate([
                    { $match: { $expr: {
                        $or: [
                            {$regexMatch: {
                                input: '$fullName',
                                regex: `^${searchText}$`,
                                options: 'm'
                            }},
                            {$regexMatch: {
                                input: '$firstName',
                                regex: `^${searchText}$`,
                                options: 'm'
                            }},
                            {$regexMatch: {
                                input: '$lastName',
                                regex: `^${searchText}$`,
                                options: 'm'
                            }},
                        ]
                    }  } },
                    { $addFields: { 
                        branchIdObj: { $toObjectId: '$branchId' },
                        groupIdObj: { $toObjectId: '$groupId' },
                    } },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: 'groupIdObj',
                            foreignField: '_id',
                            pipeline: [
                                {
                                    $project: {
                                        name: '$name'
                                    }
                                }
                            ],
                            as: 'group'
                        }
                    },
                    { $unwind: '$group' },
                    {
                        $lookup: {
                            from: 'branches',
                            localField: 'branchIdObj',
                            foreignField: '_id',
                            pipeline: [
                                {
                                    $project: {
                                        name: '$name'
                                    }
                                }
                            ],
                            as: 'branch'
                        }
                    },
                    { $unwind: '$branch' }
                ])
                .toArray();
        }
    }
    
    response = {
        success: true,
        clients: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}