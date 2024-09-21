import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';
import logger from '@/logger';
import { getCurrentDate } from '@/lib/utils';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response = {};
    let statusCode = 200;
    let data = req.body;
    logger.debug({page: `Update Cash Collection For Pending Loans - Group ID: ${data[0].groupId}`});
    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
    data.map(async cc => {
        if ((cc?.loanFor == 'today' || (cc?.loanFor == 'tomorrow' && cc?.dateOfRelease == currentDate))) {
            await updatePendingLoan(db, cc, currentDate);
        } else {
            await db.collection('loans').updateOne({ _id: new ObjectId(cc.loanId) }, { $set: { status: 'completed' } });
            await db.collection('cashCollections').updateOne({ clientId: cc.clientId, dateAdded: currentDate }, { $set: { status: 'completed' } });
        }
    });

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updatePendingLoan(db, collection, currentDate) {
    const ObjectId = require('mongodb').ObjectId;
    logger.debug({page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentDate: currentDate});
    let currentLoan = await db.collection('loans').find({ _id: new ObjectId(collection.loanId) }).toArray();
    let pendingLoan = await db.collection('loans').find({ clientId: collection.clientId, status: 'pending' }).toArray();
    let cashCollection = await db.collection('cashCollections').find({ clientId: collection.clientId, dateAdded: currentDate }).toArray();
    logger.debug({page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentLoanSize: currentLoan.length, pendingLoanSize: pendingLoan.length, cashCollectionSize: cashCollection.length});
    if (currentLoan.length > 0 && pendingLoan.length > 0 && cashCollection.length > 0) {
        currentLoan = currentLoan[0];
        pendingLoan = pendingLoan[0];
        cashCollection = cashCollection[0];

        const currentLoanId = currentLoan._id;
        const pendingLoanId = pendingLoan._id;
        const cashCollectionId = cashCollection._id;
        delete currentLoan._id;
        delete pendingLoan._id;
        delete cashCollection._id;
        logger.debug({page: `Saving Cash Collection - Updating Pending Loan`, currentLoan: currentLoan, pendingLoan: pendingLoan, cashCollection: cashCollection, collection: collection});
        await db.collection('loans').updateOne({ _id: currentLoanId}, { $set: { 
            status: 'closed',
            loanBalance: 0,
            amountRelease: 0,
            activeLoan: 0,
            mcbu: 0,
            mcbuCollection: collection.mcbu,
            noOfPayments: collection.noOfPayments,
            fullPaymentDate: collection.fullPaymentDate ? collection.fullPaymentDate : currentDate,
            mcbuWithdrawal: collection.mcbuWithdrawal > 0 ? collection.mcbuWithdrawal : 0,
            mcbuReturnAmt: collection.mcbuReturnAmt > 0 ? collection.mcbuReturnAmt : 0,
            history: cashCollection.history ? cashCollection.history : collection.history
         } });
        await db.collection('loans').updateOne({ _id: pendingLoanId}, { $set: {
            mcbu: cashCollection.mcbu,
            prevLoanFullPaymentDate: currentDate,
            prevLoanFullPaymentAmount: collection.fullPayment,
            mcbu: collection.mcbu,
            mcbuWithdrawal: collection.mcbuWithdrawal
        } });
        await db.collection('cashCollections').updateOne({ _id: cashCollectionId}, { $set: {
            loanId: pendingLoan._id + "",
            currentReleaseAmount: pendingLoan.amountRelease,
            prevLoanId: currentLoan._id + ""
        } });
    }
}