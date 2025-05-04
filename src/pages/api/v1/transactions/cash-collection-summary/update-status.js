import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';

let response = {};
let statusCode = 200;

const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

export default apiHandler({
    post: updateStatus
});

async function updateStatus(req, res) {
    const { db } = await connectToDatabase();

    const { loId, groupIds } = req.body;

    if (groupIds.length > 0) {
        let error = false;
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(groupIds.map(async (id) => {
                // const cashCollection = await db.collection('cashCollections').find({ groupId: id, dateAdded: currentDate }).toArray();
                
                // if (cashCollection.length === 0) {
                //     error = true;
                // }

                const groupSummary = await db.collection('groupCashCollections').find({ groupId: id, dateAdded: currentDate }).toArray();

                if (groupSummary.length > 0) {
                    if (groupSummary[0].status === 'pending') {
                        error = true;
                    }
                }
            }));

            resolve(response);
        });

        if (promise) {
            if (error) {
                response = { error: true, message: "One or more group/s transaction is not yet closed."};
            } else {
                await db.collection('cashCollections').updateMany(
                    { loId: loId, dateAdded: currentDate },
                    { $set: { forLos: true } }
                );

                response = { success: true }
            }
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}