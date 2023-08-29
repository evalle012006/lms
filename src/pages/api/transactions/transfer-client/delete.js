import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteTransfer
});

async function deleteTransfer(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { id } = req.body;

    let statusCode = 200;
    let response = {};

    const transferClient = await db
        .collection('transferClients')
        .find({ _id: new ObjectId(id) })
        .toArray();

    if (transferClient.length > 0) {
        if (transferClient[0].status === 'pending') {
            await db
                .collection('transferClients')
                .deleteOne({ _id: transferClient[0]._id });

            response = { success: true }
        }
    } else {
        response = {
            error: true,
            message: `Selected data not exist`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}