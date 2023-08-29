import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: updateLosData
});

async function updateLosData(req, res) {
    const { db } = await connectToDatabase();

    const { userId, date, newLos } = req.body;

    const losData = await db.collection('losTotals').find({ userId: userId, userType: 'lo', dateAdded: date }).toArray();

    if (losData.length > 0) {
        await db.collection('losTotals').updateOne({ _id: losData[0]._id }, { $set: {...newLos} });
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}