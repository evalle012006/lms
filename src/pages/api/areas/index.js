import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    get: getArea,
    post: updateArea
});

async function getArea(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const area = await db.collection('areas')
            .aggregate([
                { $match: { _id: new ObjectId(_id) } },
                { $addFields: { areaIdStr: { $toString: '$_id' } } },
                {
                    $lookup: {
                        from: "users",
                        localField: "areaId",
                        foreignField: "areaIdStr",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.shortCode', 'area_admin']} } }
                        ],
                        as: "managers"
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: "areaId",
                        foreignField: "areaIdStr",
                        as: "branches"
                    }
                }
            ])
            .toArray();

    response = { success: true, area: area[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateArea(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const area = req.body;
    const areaId = area._id;
    delete area._id;

    const resp = await db
        .collection('areas')
        .updateOne(
            { _id: new ObjectId(areaId) }, 
            {
                $set: { ...area }
            }, 
            { upsert: false });

    const updatedUsers = await db.collection('users').updateMany(
        { areaId: areaId },
        { $unset: { areaId: 1 } }
    )

    if (updatedUsers) {
        area.managerIds.map(async u => {
            await db.collection('users').updateOne(
                    { _id: new ObjectId(u) },
                    { $set: { areaId: areaId } },
                    { upsert: false }
                );
        });
    }

    const updatedBranches = await db.collection('branches').updateMany(
        { areaId: areaId },
        { $unset: { areaId: 1 } }
    )

    if (updatedBranches) {
        area.branchIds.map(async b => {
            await db.collection('branches').updateOne(
                    { _id: new ObjectId(b) },
                    { $set: { areaId: areaId } },
                    { upsert: false }
                );
        });
    }

    response = { success: true, area: resp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}