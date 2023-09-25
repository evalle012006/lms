import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: addLOSCommulative
});

async function addLOSCommulative(req, res) {
    const { db } = await connectToDatabase();

    const data = req.body;

    const los = await db.collection('losTotals').find({ userId: data.userId, month: data.month, year: data.year }).toArray();

    let result;
    if (los.length > 0) {
        let exist = los[0];
        exist.data = data.data;
        exist.modifiedDateTime = new Date();
        delete exist._id;
        result = await db.collection('losTotals').updateOne({ _id: los[0]._id }, { $set: { ...exist } });
    } else {
        result = await db.collection('losTotals').insertOne({...data});
    }

    response = { success: true, result: result };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}