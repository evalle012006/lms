import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: saveUpdate,
    get: getList
});

let statusCode = 200;
let response = {};

async function saveUpdate(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const clientData = req.body;

    if (clientData?._id) {
        const transferId = clientData._id;
        await db.collection("transferClients").updateOne({ _id: new ObjectId(transferId) }, { $set: { ...clientData, insertedDateTime: new Date() } });
        response = { success: true };
    } else {
        const exist = await db.collection("transferClients").find({ selectedClientId: clientData.selectedClientId, status: "pending" }).toArray();

        if (exist.length === 0) {
            await db.collection("transferClients").insertOne({...clientData, modifiedDateTime: new Date()});
            response = { success: true };
        } else {
            response = { error: true, message: "Client has an existing pending transfer." };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getList(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;

    if (_id) {
        const areaManager = await db.collection("users").find({ _id: new ObjectId(_id) }).toArray();
        if (areaManager.length > 0) {
            const branchCodes = areaManager[0].designatedBranch;
            const branches = await db.collection("branches").find({ $expr: { $in: ['$code', branchCodes] } }).toArray();
            if (branches.length > 0) {
                const branchIds = branches.map(b => b._id + '');
                const transferClients = await db
                    .collection('transferClients')
                    .aggregate([
                        { $match: { $expr: {$and: [{$eq: ['$status', 'pending']}, {$in: ['$sourceBranchId', branchIds]}]} } },
                        {
                            $addFields: {
                                "clientIdObj": { $toObjectId: "$selectedClientId" },
                                "loanIdObj": { $toObjectId: "$loanId" },
                                "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                                "targetGroupIdObj": { $toObjectId: "$targetGroupId" }
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
                                from: "loans",
                                localField: 'loanIdObj',
                                foreignField: '_id',
                                as: 'loans'
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: 'sourceGroupIdObj',
                                foreignField: '_id',
                                as: 'sourceGroup'
                            }
                        },
                        {
                            $unwind: "$sourceGroup"
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: 'targetGroupIdObj',
                                foreignField: '_id',
                                as: 'targetGroup'
                            }
                        },
                        {
                            $unwind: "$targetGroup"
                        },
                        { $project: { clientIdObj: 0, loanIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0 } }
                    ])
                    .toArray();

                    response = { success: true, data: transferClients };
            } else {
                response = { error: true, message: "No data found." };
            }
        } else {
            response = { error: true, message: "No data found." };
        }
    } else {
        const transferClients = await db
            .collection('transferClients')
            .aggregate([
                { $match: { $expr: { $eq: ['$status', 'pending'] } } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$selectedClientId" },
                        "loanIdObj": { $toObjectId: "$loanId" },
                        "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                        "targetGroupIdObj": { $toObjectId: "$targetGroupId" }
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
                        from: "loans",
                        localField: 'loanIdObj',
                        foreignField: '_id',
                        as: 'loans'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'sourceGroupIdObj',
                        foreignField: '_id',
                        as: 'sourceGroup'
                    }
                },
                {
                    $unwind: "$sourceGroup"
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'targetGroupIdObj',
                        foreignField: '_id',
                        as: 'targetGroup'
                    }
                },
                {
                    $unwind: "$targetGroup"
                },
                { $project: { clientIdObj: 0, loanIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0 } }
            ])
            .toArray();

            response = { success: true, data: transferClients };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}