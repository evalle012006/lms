import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export default apiHandler({
    get: getProgram,
    post: saveProgram,
    put: updateProgram
});

let statusCode = 200;
let response = {};
let success = true;

async function getProgram(req, res) {
    const { db } = await connectToDatabase();
    const condition = req.query.jobId ? { jobId: req.query.jobId } : {};

    const programs = await db
        .collection('programs')
        .find(condition)
        .toArray();

    response = { success, programs };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveProgram(req, res) {
    const { db } = await connectToDatabase();

    const program = await db
        .collection('programs')
        .insertOne({
            ...req.body,
            dateAdded: new Date
        });

    response = { success, program };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateProgram(req, res) {
    const { db } = await connectToDatabase();
    const { groupIndex, productIndex, applicationIndex } = req.body;
    const path = `products.${groupIndex}.data.${productIndex}.application.${applicationIndex}.checked`;

    const program = await db
        .collection('programs')
        .updateOne({
            _id: ObjectId(req.body.program)
        }, {
            $set: { [path]: req.body.value }
        });

    response = { success, program };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}