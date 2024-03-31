import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteBranch
});

async function deleteBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const area = await db
        .collection('areas')
        .find({ _id: new ObjectId(_id) })
        .toArray();

    if (area.length > 0) {
        const user = await db.collection('users').find({ areaId: area[0]._id + '' }).toArray();
        const branches = await db.collection('branches').find({ areaId: area[0]._id + '' }).toArray();

        if (user.length > 0 || branches.length > 0) {
            response = {
                error: true,
                message: `Can't delete area ${area[0].name} it is currently link to a user/branches.`
            };
        } else {
            await db
                .collection('areas')
                .deleteOne({ _id: new ObjectId(_id) });

            response = {
                success: true
            }
        }
    } else {
        response = {
            error: true,
            message: `Area with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}