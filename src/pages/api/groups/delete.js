import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteGroup
});

async function deleteGroup(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const groups = await db
        .collection('groups')
        .find({ _id: new ObjectId(_id) })
        .toArray();
    
    if (groups[0].noOfClients > 0) {
        response = {
            error: true,
            message: `Groups has associated clients. Can't remove.`
        };
    } else if (groups.length > 0) {
        await db
            .collection('groups')
            .deleteOne({ _id: new ObjectId(_id) });

        response = {
            success: true
        }
    } else {
        response = {
            error: true,
            message: `Group with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
