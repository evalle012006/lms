import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    get: getBranch,
    post: updateBranch
});

async function getBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id, code } = req.query;
    let statusCode = 200;
    let response = {};

    let branch;

    if (_id) {
        branch = await db.collection('branches')
            // .find({ _id: ObjectId(_id)})
            .aggregate([
                { $match: { _id: ObjectId(_id) } },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 3]} } }
                        ],
                        as: "branchManager"
                    }
                },
                { $unwind: '$branchManager' }
            ])
            .toArray();
    } else if (code) {
        branch = await db.collection('branches')
            .aggregate([
                { $match: { code: code } },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 3]} } }
                        ],
                        as: "branchManager"
                    }
                },
                { $unwind: '$branchManager' }
            ])
            .toArray();
    }

    response = { success: true, branch: branch[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const branch = req.body;
    const branchId = branch._id;
    delete branch._id;

    const branchResp = await db
        .collection('branches')
        .updateOne(
            { _id: ObjectId(branchId) }, 
            {
                $set: { ...branch }
            }, 
            { upsert: false });

    response = { success: true, branch: branchResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}