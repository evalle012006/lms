import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";

export default apiHandler({
    post: updateClient,
    get: getClient
});

async function getClient(req, res) {
    const { id } = req.query;

    let statusCode = 200;
    let response = {};
    const clients = await findClientByID(id)

    response = {
        success: true,
        clients: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const findClientByID = async (id) => {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const condition = id ? { _id: ObjectId(id) } : {};

    const clients = await db
        .collection('client')
        .find(condition)
        .project({ password: 0 })
        .toArray();

    return clients.length > 0 && clients[0];
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