import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateJob
});

let statusCode = 200;
let response = {};
let success = true;

async function updateJob(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    if (req.body.job) {
        const job = await db
            .collection('jobs')
            .update({
                _id: ObjectId(req.body.job)
            }, {
                $set: { order: req.body.order, stage: req.body.stage, status: "In Progress" }
            });
        response = { success, job };
    } else {
        response = {
            success: false,
            message: 'Object not found in MongoDB.'
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}