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
    const { id } = req.query;
    let statusCode = 200;
    let response = {};
    const branch = await db.collection('branches').find({ _id: ObjectId(id)}).toArray();
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