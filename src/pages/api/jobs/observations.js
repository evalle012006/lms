import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getObservation,
    post: saveObservation
});

let statusCode = 200;
let response = {};
let success = true;

async function getObservation(req, res) {
    const { db } = await connectToDatabase();
    const condition = req.query.jobId ? { jobId: req.query.jobId } : {};

    const observations = await db
        .collection('observations')
        .find(condition)
        .toArray();

    response = { success, observations };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveObservation(req, res) {
    const { db } = await connectToDatabase();
    const body = req.body;

    const observation = await db
        .collection('observations')
        .insertOne(body);

    response = { success, observation };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}