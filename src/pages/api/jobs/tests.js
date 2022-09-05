import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getTests,
    post: saveTests
});

let statusCode = 200;
let response = {};
let success = true;

async function getTests(req, res) {
    const ObjectId = require('mongodb').ObjectId;
    const { db } = await connectToDatabase();
    const { test } = req.query;

    const tests = await db
        .collection('tests')
        .find({ _id: ObjectId(test) })
        .toArray();

    response = { ...response, success, tests };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveTests(req, res) {
    const { db } = await connectToDatabase();
    const body = JSON.parse(req.body.replace('\\r\\n', ''));

    const test = await db
        .collection('tests')
        .insertOne(body)

    response = { success, test };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}