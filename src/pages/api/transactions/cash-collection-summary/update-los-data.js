import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

let response = {};
let statusCode = 200;

const currentDate = moment().format('YYYY-MM-DD');

export default apiHandler({
    post: updateStatus
});

async function updateStatus(req, res) {
    const { db } = await connectToDatabase();

    const losDaily = await db.collection('losTotals').find({ losType: 'daily'}).toArray();

    losDaily.map(async los => {
        let temp = {...los};
        temp.data.mispaymentPerson = 0;

        await db.collection('losTotals').updateOne({ _id: temp._id }, { $set: {...temp} });
    });

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}