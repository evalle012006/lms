import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const division = req.body;
    const ObjectId = require('mongodb').ObjectId;
    const { db } = await connectToDatabase();

    const divisions = await db
        .collection('divisions')
        .find({ name: division.name })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (divisions.length > 0) {
        response = {
            error: true,
            fields: ['name'],
            message: `Division with the name "${division.name}" already exists`
        };
    } else {
        const divisionResp = await db.collection('divisions').insertOne({
            name: division.name,
            managerIds: division.managerIds,
            regionIds: division.regionIds,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });

        if (divisionResp.acknowledged) {
            const divisionId = divisionResp.insertedId + '';

            division.managerIds.map(async u => {
                await db.collection('users').updateOne(
                        { _id: new ObjectId(u) },
                        { $set: { divisionId: divisionId } },
                        { upsert: false }
                    );
            });

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
                response = {
                    success: true,
                    division: divisionResp
                }
            }
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}