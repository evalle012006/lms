import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const area = req.body;
    const ObjectId = require('mongodb').ObjectId;
    const { db } = await connectToDatabase();

    const areas = await db
        .collection('areas')
        .find({ name: area.name })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (areas.length > 0) {
        response = {
            error: true,
            fields: ['name'],
            message: `Area with the name "${area.name}" already exists`
        };
    } else {
        const areaResp = await db.collection('areas').insertOne({
            name: area.name,
            managerIds: area.managerIds,
            branchIds: area.branchIds,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });

        if (areaResp.acknowledged) {
            const areaId = areaResp.insertedId + '';

            area.managerIds.map(async u => {
                await db.collection('users').updateOne(
                        { _id: new ObjectId(u) },
                        { $set: { areaId: areaId } },
                        { upsert: false }
                    );
            });

            area.branchIds.map(async b => {
                await db.collection('branches').updateOne(
                        { _id: new ObjectId(b) },
                        { $set: { areaId: areaId } },
                        { upsert: false }
                    );
            });
        }

        response = {
            success: true,
            area: areaResp
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}