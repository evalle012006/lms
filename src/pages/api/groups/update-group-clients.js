import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateGroup
});


async function updateGroup(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const groups = await db.collection('groups').find().toArray();

    groups.map(async group => {
        let temp = {...group};

        const clients = await db.collection('client').find({ groupId: group._id + '' }).toArray();

        if (clients.length > 0) {
            temp.noOfClients = clients.length;

            delete temp._id;
            await db.collection('groups').updateOne(
                { _id: ObjectId(group._id) },
                { $set: { ...temp } },
                { upsert: false }
            );
        }
    });

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}