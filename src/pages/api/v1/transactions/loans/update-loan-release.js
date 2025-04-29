import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: updateLoan
});

async function updateLoan(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const { loanId, principalLoan } = req.body;
    const currentLoan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
    logger.debug({page: `Updating Loan Release`, loanId: loanId, principalLoan: principalLoan});
    if (currentLoan.length === 0 ) {
        response = { error: true, message: 'No Active Loan associated to this client.' };
    } else {
        let loan = currentLoan[0];

        loan.principalLoan = principalLoan;
        
        if (loan.noOfPayments == 0) {
            if (loan.occurence === 'weekly') {
                loan.activeLoan = (principalLoan * 1.20) / 24;
                loan.loanTerms = 24;
            } else if (loan.occurence === 'daily') {
                if (loan.loanTerms === 60) {
                    loan.activeLoan = (principalLoan * 1.20) / 60;
                } else {
                    loan.activeLoan = (principalLoan * 1.20) / 100;
                }
            }
    
            loan.loanBalance = principalLoan * 1.20;
            loan.amountRelease = loan.loanBalance;
    
            await db.collection('cashCollections').updateMany({ loanId: loanId, status: { $in: ['tomorrow', 'pending'] } }, {$set: { currentReleaseAmount: loan.amountRelease }});
            logger.debug({page: `Updating Loan Release`, data: loan});
            delete loan._id;
            await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: { ...loan } });

            response = { success: true  };
        } else {
            response = { error: true, message: "Updating loan release not allowed since client has already payment collected!" };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}