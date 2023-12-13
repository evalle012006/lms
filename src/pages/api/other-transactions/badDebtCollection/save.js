import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let response = {};
    let statusCode = 200;

    const formData = req.body;

    const maturedLoan = await db.collection('loans').find({ _id: new ObjectId(formData.loanId), maturedPD: true }).toArray();

    if (maturedLoan.length > 0) {
        let loan = maturedLoan[0];
        const collection = parseFloat(formData.paymentCollection);
        // loan.loanBalance -= collection;
        loan.maturedPastDue -= collection;
        if (loan.hasOwnProperty('noBadDebtPayment')) {
            loan.noBadDebtPayment += 1;
        } else {
            loan.noBadDebtPayment = 1;
        }

        const netBalance = loan.maturedPastDue - loan.mcbu;
        if (netBalance <= 0) {
            loan.maturedPastDue = 0;
        }

        delete loan._id;

        await db.collection('loans').updateOne({ _id: new ObjectId(formData.loanId) }, { $set: { ...loan } });

        const data = await db.collection('badDebtCollections').insertOne({
            ...formData,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });
    
        response = {
            success: true,
            data: data
        }
    } else {
        response = {
            error: true,
            message: 'No matured loan detected for this client!'
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}