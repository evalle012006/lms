import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const {mode, groupId, branchId} = req.query;

    let statusCode = 200;
    let response = {};
    let clients;


    if (mode === 'view_active_by_group' && groupId) {
        clients = await db
            .collection('loans')
            .aggregate([
                { $match: { "groupId": groupId, 'status': 'active' } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "groupIdObj": { $toObjectId: "$groupId" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { "status": "active" } }
                        ],
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
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
                { $project: { groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_by_group' && groupId) {
        clients = await db
            .collection('loans')
            .aggregate([
                { $match: { "groupId": groupId } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$clientId" },
                        "groupIdObj": { $toObjectId: "$groupId" }
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { "status": "active" } }
                        ],
                        as: "client"
                    }
                },
                {
                    $unwind: "$client"
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
                { $project: { groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
    } else if (mode === 'view_all_by_branch' && branchId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { branchId: branchId } },
                {
                    $addFields: {
                        "clientId": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        // pipeline: [
                        //     { $match: { "status": "active" } }
                        // ],
                        as: "loans"
                    }
                }
            ])
            .toArray();
    } else if (mode === 'view_only_no_exist_loan' && branchId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { branchId: branchId } },
                {
                    $addFields: {
                        "clientId": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        as: "loans"
                    }
                },
                {
                    "$match": { "loans.0": { "$exists": false } }
                }
            ])
            .toArray();
    } else {
        clients = await db
            .collection('client')
            .aggregate([
                {
                    $addFields: {
                        "clientId": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        as: "loans"
                    }
                }
            ])
            .toArray();
    }
    
    response = {
        success: true,
        clients: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
