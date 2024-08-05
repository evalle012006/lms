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

    const { pnNumber, branchId, currentDate } = req.query;

    const loans = await db.collection('loans').find( { branchId: branchId, pnNumber: pnNumber, admissionDate: currentDate, status: { $nin: ['closed', 'reject'] } } ).toArray();
    let message;
    if (loans && loans.length > 0) {
        message = "PN Number already in used.";
    }

    response = { success: true, loans: loans, message: message };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}