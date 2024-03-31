import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getDivision,
    post: updateDivision
});

async function getDivision(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const division = await db.collection('divisions')
            .aggregate([
                { $match: { _id: new ObjectId(_id) } },
                { $addFields: { divisionIdStr: { $toString: '$_id' } } },
                {
                    $lookup: {
                        from: "users",
                        localField: "divisionId",
                        foreignField: "divisionIdStr",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.shortCode', 'deputy_director']} } }
                        ],
                        as: "managers"
                    }
                },
                {
                    $lookup: {
                        from: "regions",
                        localField: "divisionId",
                        foreignField: "divisionIdStr",
                        as: "regions"
                    }
                }
            ])
            .toArray();

    response = { success: true, division: division[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateDivision(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const division = req.body;
    const divisionId = division._id;
    delete division._id;

    const resp = await db
        .collection('divisions')
        .updateOne(
            { _id: new ObjectId(divisionId) }, 
            {
                $set: { ...division }
            }, 
            { upsert: false });

    const updatedUsers = await db.collection('users').updateMany(
        { divisionId: divisionId },
        { $unset: { divisionId: 1 } }
    )

    if (updatedUsers) {
        division.managerIds.map(async u => {
            await db.collection('users').updateOne(
                    { _id: new ObjectId(u) },
                    { $set: { divisionId: divisionId } },
                    { upsert: false }
                );
        });
    }

    const updatedRegions = await db.collection('regions').updateMany(
        { divisionId: divisionId },
        { $unset: { divisionId: 1 } }
    )
    
    const updatedAreas = await db.collection('areas').updateMany(
        { divisionId: divisionId },
        { $unset: { divisionId: 1 } }
    )

    const updatedBranches = await db.collection('branches').updateMany(
        { divisionId: divisionId },
        { $unset: { divisionId: 1 } }
    )

    if (updatedRegions && updatedAreas && updatedBranches) {
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(division.regionIds.map(async (regionId) => {
                await db.collection('regions').updateOne(
                    { _id: new ObjectId(regionId) },
                    { $set: { divisionId: divisionId } },
                    { upsert: false }
                );

                const region = await db.collection('regions').findOne({ _id: new ObjectId(regionId) });
                if (region) {
                    const managerIds = region.managerIds;
                    await Promise.all(managerIds.map(async (managerId) => {
                        await db.collection('users').updateOne(
                            { _id: new ObjectId(managerId) },
                            { $set: { divisionId: divisionId } },
                            { upsert: false }
                        );
                    }));

                    const areaIds = region.areaIds;
                    await Promise.all(areaIds.map(async (areaId) => {
                        await db.collection('areas').updateOne(
                            { _id: new ObjectId(areaId) },
                            { $set: { divisionId: divisionId } },
                            { upsert: false }
                        );

                        const area = await db.collection('areas').findOne({ _id: new ObjectId(areaId) });
                        if (area) {
                            const branchIds = area.branchIds;
                            await Promise.all(branchIds.map(async (branchId) => {
                                await db.collection('branches').updateOne(
                                    { _id: new ObjectId(branchId) },
                                    { $set: { divisionId: divisionId } },
                                    { upsert: false }
                                );
                            }));
                        }
                    }));
                }
            }));

            resolve(response);
        });

        if (promise) {
            response = { success: true, division: resp };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}