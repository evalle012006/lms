import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const loanData = req.body;

    const { db } = await connectToDatabase();

    const loans = await db
        .collection('loans')
        .find({ code: code })
        .toArray();

    let response = {};
    let statusCode = 200;

    // if (branches.length > 0) {
    //     response = {
    //         error: true,
    //         fields: ['code'],
    //         message: `Branch with the code "${code}" already exists`
    //     };
    // } else {
        const loan = await db.collection('loans').insertOne({
            ...loanData,
            dateAdded: moment(new Date()).format('YYYY-MM-DD')
        });

        response = {
            success: true,
            loan: loan
        }
    // }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}