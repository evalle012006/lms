import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const loanData = req.body;

    const { db } = await connectToDatabase();

    let response = {};
    let statusCode = 200;

    const loans = await db
        .collection('loans')
        .find({ $expr: { $and: [{$eq: ['$clientId', loanData.clientId, { $or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}] }]}] } })
        .toArray();

    if (loans.length > 0) {
        response = {
            error: true,
            fields: ['cliendId'],
            message: `Client has an active loan.`
        };
    } else {
        const loan = await db.collection('loans').insertOne({
            ...loanData,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });

        response = {
            success: true,
            loan: loan
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}