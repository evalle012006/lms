import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

let response = {};
let statusCode = 200;

const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const { db } = await connectToDatabase();

    const data = req.body;

    if (data.userType === 'bm') {
        let bm = await db.collection('users').find({ $expr: {$and: [{$eq: ['$role.rep', 3]}, {$eq: ['$designatedBranchId', data.branchId]}]} }).toArray();
        if (bm.length > 0) {
            bm = bm[0];
            let userId = bm._id + '';

            let losTotal = await db.collection('losTotals').find({ userId: userId, month: data.month, year: data.year }).toArray();

            if (losTotal.length === 0) {
                await db.collection('losTotals').insertOne(
                    { ...data, userId: userId, dateAdded: moment().format('YYYY-MM-DD') }
                );
            }
        }
    } else {
        data.map(async collection => {
            let losTotal = await db.collection('losTotals').find({ userId: collection.userId, month: collection.month, year: collection.year }).toArray();

            if (losTotal.length === 0) {
                await db.collection('losTotals').insertOne(
                    { ...collection, dateAdded: moment().format('YYYY-MM-DD') }
                );
            }
        });
    }

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}