import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getTestList,
    post: updateTest
});

let statusCode = 200;
let response = {};
let success = true;

async function getTestList(req, res) {
    const ObjectId = require('mongodb').ObjectId;
    const { db } = await connectToDatabase();
    const { test } = req.query;

    const tests = await db
        .collection('tests')
        .find({ job_id: null })
        .toArray();

    response = { ...response, success, tests };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateTest(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const {test_id, client, job_id} = req.body;

    const clients = await db
        .collection('client')
        .find({ _id: ObjectId(client) })
        .project({ _id: 0 })
        .toArray();

    if (clients.length === 0) {
        response = { success: false, message: "Client Data not found!" };
    } else {
        const test = await db
            .collection('tests')
            .updateOne(
                {_id: ObjectId(test_id)},
                {
                    $set: {
                        job_id: job_id,
                        client: clients[0].name,
                        property: clients[0].propertyName
                    }
                },
                { upsert: false }
            );
        response = { success, test: {...test, upsertedId: test_id} };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}