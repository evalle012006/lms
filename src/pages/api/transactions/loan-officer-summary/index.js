import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { date, userId, branchId } = req.query;
    let statusCode = 200;
    let response = {};
    let data;

    const user = await db.collection('users').find({ _id: ObjectId(userId) }).toArray();

    if (user.length > 0) {
        const startOfMonth = moment(date).startOf('month').format('YYYY-MM-DD');
        const endOfMonth = moment(date).endOf('month').format('YYYY-MM-DD');

        const currentMonth = moment(date).month() + 1;
        const currentYear = moment(date).year();

        const lastMonth = moment(date).subtract(1, 'months').month() + 1;
        const lastYear = lastMonth === 12 ? moment(date).subtract(1, 'years').year() : moment(date).year();

        const userId = user[0]._id + '';

        const fBalance = await db.collection('losTotals').find({ userId: userId, month: lastMonth, year: lastYear }).toArray();

        const summary = await db.collection('losTotals').find({ userId: userId, month: currentMonth, year: currentYear }).toArray();

        data = {
            fBalance: fBalance.length > 0 ? fBalance : [],
            current: summary
        }
    }
        
    response = { success: true, data: data };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}