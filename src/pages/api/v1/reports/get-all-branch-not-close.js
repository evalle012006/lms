import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const { currentUserId, branchId, loId } = req.query;

    let cashCollectionsDraft;
    let cashCollectionsPending;

    if (loId) {
        cashCollectionsDraft = await db.collection('cashCollections')
            .aggregate([
                { $match: { draft: true, loId: loId } },
                { $addFields: {
                    branchId: { $toObjectId: '$branchId' },
                    loId: { $toObjectId: '$loId' }
                } },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { name: '$name' } }
                        ],
                        as: "branch"
                    }
                },
                {
                    $unwind: '$branch'
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { firstName: '$firstName', lastName: '$lastName' } }
                        ],
                        as: "loanOfficer"
                    }
                },
                {
                    $unwind: '$loanOfficer'
                },
                { $project: {
                    branchName: '$branch.name',
                    loanOfficerFirstName: '$loanOfficer.firstName',
                    loanOfficerLastName: '$loanOfficer.lastName',
                    groupId: '$groupId',
                    groupName: '$groupName',
                    clientId: '$clientId',
                    clientName: '$fullName',
                    slotNo: '$slotNo',
                    loanId: '$loanId',
                    dateAdded: '$dateAdded'
                } }
            ])
            .toArray();

        cashCollectionsPending = await db.collection('cashCollections')
            .aggregate([
                { $match: { groupStatus: 'pending', loId: loId } },
                { $addFields: {
                    branchId: { $toObjectId: '$branchId' },
                    loId: { $toObjectId: '$loId' }
                } },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { name: '$name' } }
                        ],
                        as: "branch"
                    }
                },
                {
                    $unwind: '$branch'
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { firstName: '$firstName', lastName: '$lastName' } }
                        ],
                        as: "loanOfficer"
                    }
                },
                {
                    $unwind: '$loanOfficer'
                },
                { $project: {
                    branchName: '$branch.name',
                    loanOfficerFirstName: '$loanOfficer.firstName',
                    loanOfficerLastName: '$loanOfficer.lastName',
                    groupId: '$groupId',
                    groupName: '$groupName',
                    clientId: '$clientId',
                    clientName: '$fullName',
                    slotNo: '$slotNo',
                    loanId: '$loanId',
                    dateAdded: '$dateAdded'
                } }
            ])
            .toArray();
    } else if (branchId || currentUserId) {
        if (branchId) {
            cashCollectionsDraft = await getByBranchDraft(branchId);
            cashCollectionsPending = await getByBranchPending(branchId);
        } else {
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

                const draftData = [];
                const pendingData = [];
                const promise = await new Promise(async (resolve) => {
                    const response = await Promise.all(branchIds.map(async (branchId) => {
                        draftData.push.apply(draftData, await getByBranchDraft(branchId));
                        pendingData.push.apply(pendingData, await getByBranchPending(branchId));
                    }));

                    resolve(response);
                });

                if (promise) {
                    cashCollectionsDraft = draftData;
                    cashCollectionsPending = pendingData;
                }
            }
        }
    } else {
        cashCollectionsDraft = await db.collection('cashCollections')
            .aggregate([
                { $match: { draft: true } },
                { $addFields: {
                    branchId: { $toObjectId: '$branchId' },
                    loId: { $toObjectId: '$loId' }
                } },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { name: '$name' } }
                        ],
                        as: "branch"
                    }
                },
                {
                    $unwind: '$branch'
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { firstName: '$firstName', lastName: '$lastName' } }
                        ],
                        as: "loanOfficer"
                    }
                },
                {
                    $unwind: '$loanOfficer'
                },
                { $project: {
                    branchName: '$branch.name',
                    loanOfficerFirstName: '$loanOfficer.firstName',
                    loanOfficerLastName: '$loanOfficer.lastName',
                    groupId: '$groupId',
                    groupName: '$groupName',
                    clientId: '$clientId',
                    clientName: '$fullName',
                    slotNo: '$slotNo',
                    loanId: '$loanId',
                    dateAdded: '$dateAdded'
                } }
            ])
            .toArray();

        cashCollectionsPending = await db.collection('cashCollections')
            .aggregate([
                { $match: { groupStatus: 'pending' } },
                { $addFields: {
                    branchId: { $toObjectId: '$branchId' },
                    loId: { $toObjectId: '$loId' }
                } },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { name: '$name' } }
                        ],
                        as: "branch"
                    }
                },
                {
                    $unwind: '$branch'
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loId",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { firstName: '$firstName', lastName: '$lastName' } }
                        ],
                        as: "loanOfficer"
                    }
                },
                {
                    $unwind: '$loanOfficer'
                },
                { $project: {
                    branchName: '$branch.name',
                    loanOfficerFirstName: '$loanOfficer.firstName',
                    loanOfficerLastName: '$loanOfficer.lastName',
                    groupId: '$groupId',
                    groupName: '$groupName',
                    clientId: '$clientId',
                    clientName: '$fullName',
                    slotNo: '$slotNo',
                    loanId: '$loanId',
                    dateAdded: '$dateAdded'
                } }
            ])
            .toArray();
    }

    response = { success: true, cashCollectionsDraft: cashCollectionsDraft, cashCollectionsPending: cashCollectionsPending };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const getByBranchDraft = async (branchId) => {
    const { db } = await connectToDatabase();

    return await db.collection('cashCollections')
        .aggregate([
            { $match: { draft: true, branchId: branchId } },
            { $addFields: {
                branchId: { $toObjectId: '$branchId' },
                loId: { $toObjectId: '$loId' }
            } },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchId",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { name: '$name' } }
                    ],
                    as: "branch"
                }
            },
            {
                $unwind: '$branch'
            },
            {
                $lookup: {
                    from: "users",
                    localField: "loId",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { firstName: '$firstName', lastName: '$lastName' } }
                    ],
                    as: "loanOfficer"
                }
            },
            {
                $unwind: '$loanOfficer'
            },
            { $project: {
                branchName: '$branch.name',
                loanOfficerFirstName: '$loanOfficer.firstName',
                loanOfficerLastName: '$loanOfficer.lastName',
                groupId: '$groupId',
                groupName: '$groupName',
                clientId: '$clientId',
                clientName: '$fullName',
                slotNo: '$slotNo',
                loanId: '$loanId',
                dateAdded: '$dateAdded'
            } }
        ])
        .toArray();
}

const getByBranchPending = async (branchId) => {
    const { db } = await connectToDatabase();

    return await db.collection('cashCollections')
        .aggregate([
            { $match: { groupStatus: 'pending', branchId: branchId } },
            { $addFields: {
                branchId: { $toObjectId: '$branchId' },
                loId: { $toObjectId: '$loId' }
            } },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchId",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { name: '$name' } }
                    ],
                    as: "branch"
                }
            },
            {
                $unwind: '$branch'
            },
            {
                $lookup: {
                    from: "users",
                    localField: "loId",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { firstName: '$firstName', lastName: '$lastName' } }
                    ],
                    as: "loanOfficer"
                }
            },
            {
                $unwind: '$loanOfficer'
            },
            { $project: {
                branchName: '$branch.name',
                loanOfficerFirstName: '$loanOfficer.firstName',
                loanOfficerLastName: '$loanOfficer.lastName',
                groupId: '$groupId',
                groupName: '$groupName',
                clientId: '$clientId',
                clientName: '$fullName',
                slotNo: '$slotNo',
                loanId: '$loanId',
                dateAdded: '$dateAdded'
            } }
        ])
        .toArray();
}