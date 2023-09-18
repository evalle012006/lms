import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getWeekDaysCount, getCurrentDate } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    get: checkPNNumber
});

async function checkPNNumber(req, res) {
    const { db } = await connectToDatabase();

    let statusCode = 200;
    let response = {};

    const { pnNumber, groupId } = req.query;

    const loans = await db.collection('loans').find( { groupId: groupId, pnNumber: pnNumber } ).toArray();
    let message;
    if (loans && loans.length > 0) {
        message = "PN Number already in used.";
    }

    response = { success: true, loans: loans, message: message };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}