import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const loans = await db.collection('loans')
        .aggregate([
            { $match: { insertedBy: "migration" } },
            { $project: {
                loId: '$loId',
                startDate: '$startDate'
            } }
        ])
        .toArray();

    response = { success: true, loans: loans };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
