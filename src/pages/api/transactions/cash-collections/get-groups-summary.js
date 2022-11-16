import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getGroupSummary
});

async function getGroupSummary(req, res) {
    const { db } = await connectToDatabase();
    const { groupId, date } = req.query;
    let statusCode = 200;
    let response = {};
    const groupCashCollections = await db
        .collection('groupCashCollections')
        .find({ groupId: groupId, dateAdded: date})
        .toArray();

    response = { success: true, groupCashCollections: groupCashCollections };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}