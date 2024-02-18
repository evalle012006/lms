import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: testOnly
});

async function testOnly(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const clientId = '650ba7e4b65f13c10205a6a7';

    const result = await db.collection("cashCollections")
                        .find({ clientId: clientId })
                        .sort({ $natural: -1 })
                        .limit(1)
                        .toArray();

    response = { success: true, data: result };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}