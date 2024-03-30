import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteDivision
});

async function deleteDivision(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const division = await db
        .collection('divisions')
        .find({ _id: new ObjectId(_id) })
        .toArray();

    if (division.length > 0) {
        const regions = await db.collection('regions').find({ divisionId: division[0]._id + '' }).toArray();

        if (regions.length > 0) {
            response = {
                error: true,
                message: `Can't delete ${division[0].name} it is currently link to a regions.`
            };
        } else {
            await db
                .collection('divisions')
                .deleteOne({ _id: new ObjectId(_id) });

            response = {
                success: true
            }
        }
    } else {
        response = {
            error: true,
            message: `Division with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}