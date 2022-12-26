import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

const currentDate = moment(new Date()).format('YYYY-MM-DD');

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    let loans;

    const { branchId, groupId, loId, status } = req.query;

    if (status) {
        if (loId && branchId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { branchId: branchId, status: status } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $unwind: "$branch"
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { "loanOfficerId": loId } }
                        ],
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                    $sort: { "dateAdded": -1 }
                },
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
        } else if (branchId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { branchId: branchId, status: status } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
        } else if (groupId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { groupId: groupId, status: status } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
        }
    } else {
        if (loId && branchId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { branchId: branchId } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $unwind: "$branch"
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { "loanOfficerId": loId } }
                        ],
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                    $sort: { "dateAdded": -1 }
                },
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
        } else if (branchId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { branchId: branchId } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
        } else if (groupId) {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { groupId: groupId } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
        } else {
            loans = await db
            .collection('loans')
            .aggregate([
                { $match: { status: 'pending' } },
                {
                    $addFields: {
                        "branchIdObj": { $toObjectId: "$branchId" },
                        "groupIdObj": { $toObjectId: "$groupId" },
                        "clientIdObj": { $toObjectId: "$clientId" }
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "branchIdObj",
                        foreignField: "_id",
                        as: "branch"
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupId",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: currentDate } },
                            { $project: { allowApproved: { $cond: { if: {$eq: ['$status', 'pending']}, then: true, else: false } } } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $unwind: "$groupCashCollections"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
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
                { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
        }
    }

    response = {
        success: true,
        loans: loans
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
