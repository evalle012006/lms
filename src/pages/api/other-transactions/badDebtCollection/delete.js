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

    await db
        .collection('badDebtCollections')
        .deleteOne({ _id: new ObjectId(_id) });

    response = {
        success: true
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
