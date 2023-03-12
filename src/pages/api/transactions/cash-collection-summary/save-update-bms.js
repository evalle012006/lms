import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const { db } = await connectToDatabase();

    const { branchId, currentDate } = req.body;

    const los = await db.collection('losTotals').updateMany(
        { losType: 'daily', dateAdded: currentDate, branchId: branchId, userType: 'lo' },
        { $set: {
            status: 'approved',
            dateApproved: currentDate
        } }
    );

    response = { success: true, data: los };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}