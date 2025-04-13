import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    get: getRegion,
    post: updateRegion
});

async function getRegion(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const region = await db.collection('regions')
            .aggregate([
                { $match: { _id: new ObjectId(_id) } },
                { $addFields: { regionIdStr: { $toString: '$_id' } } },
                {
                    $lookup: {
                        from: "users",
                        localField: "regionId",
                        foreignField: "regionIdStr",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.shortCode', 'regional_manager']} } }
                        ],
                        as: "managers"
                    }
                },
                {
                    $lookup: {
                        from: "areas",
                        localField: "regionId",
                        foreignField: "regionIdStr",
                        as: "areas"
                    }
                }
            ])
            .toArray();

    response = { success: true, region: region[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateRegion(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const region = req.body;
    const regionId = region._id;
    delete region._id;

    const resp = await db
        .collection('regions')
        .updateOne(
            { _id: new ObjectId(regionId) }, 
            {
                $set: { ...region }
            }, 
            { upsert: false });

    const updatedUsers = await db.collection('users').updateMany(
        { regionId: regionId },
        { $unset: { regionId: 1 } }
    )

    if (updatedUsers) {
        region.managerIds.map(async u => {
            await db.collection('users').updateOne(
                    { _id: new ObjectId(u) },
                    { $set: { regionId: regionId } },
                    { upsert: false }
                );
        });
    }

    const updatedAreas = await db.collection('areas').updateMany(
        { regionId: regionId },
        { $unset: { regionId: 1 } }
    )

    const updatedBranches = await db.collection('branches').updateMany(
        { regionId: regionId },
        { $unset: { regionId: 1 } }
    )

    if (updatedAreas && updatedBranches) {
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(region.areaIds.map(async (areaId) => {
                await db.collection('areas').updateOne(
                    { _id: new ObjectId(areaId) },
                    { $set: { regionId: regionId } },
                    { upsert: false }
                );

                const area = await db.collection('areas').findOne({ _id: new ObjectId(areaId) });
                if (area) {
                    const branchIds = area.branchIds;
                    await Promise.all(branchIds.map(async (branchId) => {
                        await db.collection('branches').updateOne(
                            { _id: new ObjectId(branchId) },
                            { $set: { regionId: regionId } },
                            { upsert: false }
                        );
                    }));
                }
            }));

            resolve(response);
        });

        if (promise) {
            response = { success: true, region: resp };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}