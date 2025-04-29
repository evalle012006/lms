import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const {groupId, branchId} = req.query;

    let statusCode = 200;
    let response = {};
    let clients;

    if (groupId) {
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
                            { $match: { "delinquent": "true" } }
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
                            pipeline: [
                                { $match: { "status": "active" } }
                            ],
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
                },
                { $project: { groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
    } else if (branchId) {
        clients = await db
            .collection('loans')
            .aggregate([
                { $match: { "branchId": branchId, 'status': 'active' } },
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
                            { $match: { "delinquent": "true" } }
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
                            pipeline: [
                                { $match: { "status": "active" } }
                            ],
                        as: "group"
                    }
                },
                {
                    $unwind: "$group"
                },
                { $project: { groupIdObj: 0, clientIdObj: 0 } }
            ])
            .toArray();
    } else {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { delinquent: "true" } },
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
