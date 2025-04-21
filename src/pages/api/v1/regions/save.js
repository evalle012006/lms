import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const region = req.body;
    const ObjectId = require('mongodb').ObjectId;
    const { db } = await connectToDatabase();

    const regions = await db
        .collection('regions')
        .find({ name: region.name })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (regions.length > 0) {
        response = {
            error: true,
            fields: ['name'],
            message: `Region with the name "${region.name}" already exists`
        };
    } else {
        const regionResp = await db.collection('regions').insertOne({
            name: region.name,
            managerIds: region.managerIds,
            areaIds: region.areaIds,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });

        if (regionResp.acknowledged) {
            const regionId = regionResp.insertedId + '';

            region.managerIds.map(async u => {
                await db.collection('users').updateOne(
                        { _id: new ObjectId(u) },
                        { $set: { regionId: regionId } },
                        { upsert: false }
                    );
            });

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
                response = {
                    success: true,
                    region: regionResp
                }
            }
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}