import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

let response = {};
let statusCode = 200;


export default apiHandler({
    post: syncLoans
});

async function syncLoans(req, res) {
    const { db } = await connectToDatabase();

    const { clientId, coMaker } = req.body;
    const currentLoan = await db.collection('loans').find({ status: 'available', clientId: clientId }).toArray();

    if (currentLoan.length > 0) {
        let loan = currentLoan[0];
        loan.coMaker = coMaker;
        loan.coMakerId = clientId;

        delete loan._id;
        const resp = await db.collection('loans').updateOne({ _id: currentLoan[0]._id }, { $set: { ...loan } });

        response = { success: true, ...resp };
    } else {
        response = { error: true, message: 'No Loan associated to this client.' };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}