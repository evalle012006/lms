import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    let badDebtCollection;

    const { loId, branchId, branchIds } = req.query;

    if (loId) {
        badDebtCollection = await db
            .collection('badDebtCollections')
            .aggregate([
                { $match: { loId: loId } },
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
            const branchIdsObj = JSON.parse(branchIds);
            const data = [];
            const promise = await new Promise(async (resolve) => {
                const response = await Promise.all(branchIdsObj.map(async (branchId) => {
                    data.push.apply(data, await getByBranch(branchId));
                }));

                resolve(response);
            });

            if (promise) {
                badDebtCollection = data;
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
        .collection('badDebtCollections')
        .aggregate([
            { $match: { branchId: branchId } },
            {
                $addFields: {
                    clientIdObj: { $toObjectId: '$clientId' },
                    loIdObj: { $toObjectId: '$loId' },
                    branchIdObj: { $toObjectId: '$branchId' },
                    groupIdObj: { $toObjectId: '$groupId' }
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