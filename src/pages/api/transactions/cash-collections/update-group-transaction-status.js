import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: processLOSummary
});

async function processLOSummary(req, res) {
    const { db } = await connectToDatabase();
    const { loId } = req.body;
    const currentDate = getCurrentDate();

    if (loId) {
        await db.cashCollections.updateMany(
            {
                loId: loId,
                dateAdded: moment(currentDate).format('YYYY-MM-DD')
            }, {
                $set: { groupStatus: 'closed' }
            });
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}