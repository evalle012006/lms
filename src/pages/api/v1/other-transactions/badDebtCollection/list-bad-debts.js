import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};
    let badDebtCollection;

    const { loId, branchId, branchIds, currentUserId } = req.query;

    if (loId) {
        badDebtCollection = await db
            .collection('loans')
            .aggregate([
                { $match: { loId: loId, maturedPD: true, status: "closed" } },
                {
                    $addFields: {
                        clientIdObj: { $toObjectId: '$clientId' },
                        loIdObj: { $toObjectId: '$loId' },
                        branchIdObj: { $toObjectId: '$branchId' },
                        groupIdObj: { $toObjectId: '$groupId' },
                        loanIdObj: { $toObjectId: '$loanId' }
                    }
                },
                {
                    $lookup: {
                        from: 'client',
                        localField: 'clientIdObj',
                        foreignField: '_id',
                        pipeline: [
                            { $project: { name: '$fullName' } }
                        ],
                        as: 'client'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { firstName: '$firstName', lastName: '$lastName' } }
                        ],
                        as: "lo"
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { name: '$name' } }
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
                { $project: { clientIdObj: 0, branchIdObj: 0, loIdObj: 0, groupIdObj: 0 } }
            ])
            .toArray();
    } else {
        if (branchId) {
            badDebtCollection = await getByBranch(branchId);
        } else {
            if (currentUserId) {
                const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
                if (user.length > 0) {
                    let branchIds = [];
                    if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                        const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                        branchIds = branches.map(branch => branch._id.toString());
                    } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                        const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                        branchIds = branches.map(branch => branch._id.toString());
                    } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                        const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                        branchIds = branches.map(branch => branch._id.toString());
                    }

                    const data = [];
                    const promise = await new Promise(async (resolve) => {
                        const response = await Promise.all(branchIds.map(async (branchId) => {
                            data.push.apply(data, await getByBranch(branchId));
                        }));

                        resolve(response);
                    });

                    if (promise) {
                        badDebtCollection = data;
                    }
                }
            } else {
                const branches = await db.collection('branches').find({ }).toArray();
                const branchIds = branches.map(branch => branch._id.toString());
                const data = [];
                const promise = await new Promise(async (resolve) => {
                    const response = await Promise.all(branchIds.map(async (branchId) => {
                        data.push.apply(data, await getByBranch(branchId));
                    }));

                    resolve(response);
                });

                if (promise) {
                    badDebtCollection = data;
                }
            }
        }
    }
    
    response = {
        success: true,
        data: badDebtCollection
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const getByBranch = async (branchId) => {
    const { db } = await connectToDatabase();

    return await db
        .collection('loans')
        .aggregate([
            { $match: { branchId: branchId, maturedPD: true, status: "closed" } },
            {
                $addFields: {
                    clientIdObj: { $toObjectId: '$clientId' },
                    loIdObj: { $toObjectId: '$loId' },
                    branchIdObj: { $toObjectId: '$branchId' },
                    groupIdObj: { $toObjectId: '$groupId' },
                    loanIdObj: { $toObjectId: '$loanId' }
                }
            },
            {
                $lookup: {
                    from: 'client',
                    localField: 'clientIdObj',
                    foreignField: '_id',
                    pipeline: [
                        { $project: { name: '$fullName' } }
                    ],
                    as: 'client'
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "loIdObj",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { firstName: '$firstName', lastName: '$lastName' } }
                    ],
                    as: "lo"
                }
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchIdObj",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { name: '$name' } }
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
            { $project: { clientIdObj: 0, branchIdObj: 0, loIdObj: 0, groupIdObj: 0 } }
        ])
        .toArray();
}