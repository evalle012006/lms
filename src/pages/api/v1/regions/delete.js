import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteRegion
});

async function deleteRegion(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const region = await db
        .collection('regions')
        .find({ _id: new ObjectId(_id) })
        .toArray();

    if (region.length > 0) {
        const areas = await db.collection('areas').find({ regionId: region[0]._id + '' }).toArray();

        if (areas.length > 0) {
            response = {
                error: true,
                message: `Can't delete ${region[0].name} it is currently link to a area.`
            };
        } else {
            await db
                .collection('regions')
                .deleteOne({ _id: new ObjectId(_id) });

            response = {
                success: true
            }
        }
    } else {
        response = {
            error: true,
            message: `Region with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}