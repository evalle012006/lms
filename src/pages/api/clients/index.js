import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";

export default apiHandler({
    post: updateClient,
    get: getClient
});

async function getClient(req, res) {
    const { db } = await connectToDatabase();
    const { clientId } = req.query;
    const ObjectId = require('mongodb').ObjectId;

    let statusCode = 200;
    let response = {};
    const clients = await db
        .collection('client')
        .aggregate([
            { $match: { _id: ObjectId(clientId) } },
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
                $sort: { dateGranted: -1 }
            }
        ])
        .toArray();

    response = {
        success: true,
        client: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateClient(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const client = req.body;
    const clientId = client._id;
    delete client._id;

    const clientResp = await db
        .collection('client')
        .updateOne(
            { _id: ObjectId(clientId) }, 
            {
                $set: { ...client }
            }, 
            { upsert: false });

    response = { success: true, client: clientResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}