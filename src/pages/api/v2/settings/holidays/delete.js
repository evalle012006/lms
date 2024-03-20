import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteHoliday
});

async function deleteHoliday(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const holiday = await db
        .collection('holidays')
        .find({ _id: new ObjectId(_id) })
        .toArray();

    if (holiday.length > 0) {
        await db
            .collection('holidays')
            .deleteOne({ _id: new ObjectId(_id) });

        response = {
            success: true
        }
    } else {
        response = {
            error: true,
            message: `Holiday with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
