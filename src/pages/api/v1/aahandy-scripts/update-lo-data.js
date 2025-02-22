import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: updateStatus
});

async function updateStatus(req, res) {
    const { db } = await connectToDatabase();

    const losList = await db.collection('users').find({ "role.rep": 4}).toArray();

    losList.map(async los => {
        let temp = {...los};
        temp.loNo = typeof los.loNo == 'string' ? parseInt(los.loNo) : los.loNo;

        await db.collection('users').updateOne({ _id: temp._id }, { $set: {...temp} });
    });

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}