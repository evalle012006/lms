import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

let response = {};
let statusCode = 200;

const currentDate = moment().format('YYYY-MM-DD');

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const { db } = await connectToDatabase();

    const data = req.body;

    let resp;

    let losTotal = await db.collection('losTotals').find({ userId: data.userId, month: data.month, year: data.year }).toArray();

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        resp = await db.collection('losTotals').updateOne(
            { _id: losTotal._id},
            { $set: {
                ...losTotal,
                data: data.data,
                dateModified: currentDate
            } }
        );
    } else {
        resp = await db.collection('losTotals').insertOne(
            { ...data, dateAdded: moment().format('YYYY-MM-DD') }
        );
    }

    response = { success: true, data: resp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}