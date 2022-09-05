import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getBLendData,
    post: saveBlendData
});

let statusCode = 200;
let response = {};
let success = true;

async function getBLendData(req, res) {
    const { db } = await connectToDatabase();
    const { test } = req.query;
    const ObjectId = require('mongodb').ObjectId;

    const data = await db
        .collection('tests')
        .aggregate([
            { $match: { _id: ObjectId(test) } },
            { $addFields: { "testId": { $toString: "$_id" } } },
            {
                $lookup: {
                    from: 'blendData',
                    localField: "testId",
                    foreignField: "test_id",
                    as: "blendData"
                }
            }
        ]).toArray();
    // .find({ _id: ObjectId(test) })
    // .toArray();

    response = { ...response, success, test: data };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveBlendData(req, res) {
    const { db } = await connectToDatabase();

    const data = await db
        .collection('blendData')
        .updateOne({
            test_id: req.body.test_id,
            job_id: req.body.job_id
        }, {
            $set: { ...req.body }
        }, { upsert: true });

    response = { success, body: req.body, response: data };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}