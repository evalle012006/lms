import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { findUserByEmail } from './index';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const loanData = req.body;

    const { db } = await connectToDatabase();

    const loans = await db
        .collection('loans')
        .find({ clientId: loanData.clientId, status: 'active' })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (loans.length > 0) {
        response = {
            error: true,
            fields: ['clientId'],
            message: `Client "${loanData.fullName}" already have an active loan`
        };
    } else {
        const loan = await db.collection('loans').insertOne({
            ...loanData,
            dateGranted: new Date()
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