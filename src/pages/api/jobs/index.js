import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getJobs,
    post: saveJob,
    put: updateJob
});

let statusCode = 200;
let response = {};
let success = true;

async function getJobs(req, res) {
    const { db } = await connectToDatabase();

    const { job } = req.query;
    const ObjectId = require('mongodb').ObjectId;

    if (job) {
        const jobs = await db
            .collection('jobs')
            .aggregate([
                { $match: { _id: ObjectId(job) } },
                {
                    $addFields: {
                        "jobId": { $toString: "$_id" },
                        "owner": { $toObjectId: "$owner" },
                        "agronomist": { $toObjectId: "$agronomist" },
                        "cid": {
                            $map: {
                                input: "$collaborators",
                                as: "collaborator",
                                in: { $toObjectId: "$$collaborator" }
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: "tests",
                        localField: "jobId",
                        foreignField: "job_id",
                        pipeline: [
                            { $match: { "testType": "soil" } },
                            {
                                $group: {
                                    _id: {
                                        month: {
                                            $month: { $dateFromString: { dateString: '$dateAdded' } }
                                        },
                                        year: {
                                            $year: { $dateFromString: { dateString: '$dateAdded' } }
                                        }
                                    },
                                    key: { $first: '$dateAdded' },
                                    data: { $push: "$$ROOT" }
                                }
                            }
                        ],
                        as: "soil"
                    }
                },
                {
                    $lookup: {
                        from: "tests",
                        localField: "jobId",
                        foreignField: "job_id",
                        pipeline: [
                            { $match: { "testType": "leaf" } }
                        ],
                        as: "leaf"
                    }
                },
                {
                    $lookup: {
                        from: "blendData",
                        localField: "jobId",
                        foreignField: "job_id",
                        as: "blends"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "ownerData"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "agronomist",
                        foreignField: "_id",
                        as: "agronomistData"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "cid",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { password: 0 } }
                        ],
                        as: "collaborators"
                    }
                },
                { $project: { owner: 0, agronomist: 0 } },
            ])
            .toArray();

        response = { success, jobs };
    } else {
        const jobs = await db
            .collection('jobs')
            .find()
            .toArray();

        response = { success, jobs };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveJob(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const clients = await db
        .collection('client')
        .find({ _id: ObjectId(req.body.contact) })
        .toArray();
        
    if (clients.length === 0) {
        response = { success: false, message: "Client Data not found!" };
    } else {
        const data = {
            ...req.body,
            contactId: clients[0]._id, 
            contact: clients[0].contact,
            name: clients[0].name,
            email: clients[0].email,
            property: req.body.property,
            agronomist: req.body.agronomist,
            owner: req.body.owner,
            stage: 0,
            status: 'created'
        }
        const job = await db
            .collection('jobs')
            .updateOne({
                dateAdded: req.body.dateAdded,
                property: req.body.property,
                name: clients[0].name,
                contact: clients[0].contact,
                type: req.body.type
            }, {
                $set: data
            }, { upsert: true });
        response = { success, job: data, upsert: job };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateJob(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const values = {
        collaborators: { collaborators: req.body.values},
        updatejob: req.body.values
    };

    const job = await db
        .collection('jobs')
        .updateOne({
            _id: ObjectId(req.body.job)
        }, {
            $set: { ...values[req.body.type] }
        }, { upsert: false });

    response = { success, job };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}