import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const data = req.body;
    const { db } = await connectToDatabase();

    const branchCOH = await db
        .collection('branchCOH')
        .find({ branchId: data.branchId, dateAdded: data.dateAdded })
        .toArray();

    let response = {};
    let statusCode = 200;

    let updatedData;

    if (branchCOH.length > 0) {
        updatedData = await db.collection('branchCOH').updateOne(
            { _id: branchCOH[0]._id},
            { $set: { amount: data.amount, modifiedBy: data.modifiedBy, modifiedDateTime: new Date() } }
        );
    } else {
        updatedData = await db.collection('branchCOH').insertOne({
            ...data,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });
    }

    response = {
        success: true,
        data: updatedData
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}