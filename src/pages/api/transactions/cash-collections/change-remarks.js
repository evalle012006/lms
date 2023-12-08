import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';

export default apiHandler({
    post: revert,
});

let statusCode = 200;
let response = {};

async function revert(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const cashCollection = req.body;
    logger.debug({page: 'LOR', message: 'Change Remarks', data: cashCollection});
    let loanId = cashCollection.loanId;

    const currentDate = cashCollection.currentDate;
    const newRemarks = cashCollection.newRemarks;
    let currentLoan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
    let currentCC = await db.collection('cashCollections').find({ clientId: cashCollection.clientId, dateAdded: currentDate  }).toArray();

    if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
        let previousLoan = await db.collection('loans').find({ clientId: cashCollection.clientId, loanCycle: cashCollection.loanCycle - 1, status: "closed" }).toArray();

        if (currentLoan.length > 0 && currentCC.length > 0 && previousLoan.length > 0) {
            currentLoan = currentLoan[0];
            currentCC = currentCC[0];
            const currentCCId = currentCC._id;
            previousLoan = previousLoan[0];
            const previousLoanId = previousLoan._id;
            delete currentLoan._id;
            delete currentCC._id;
            delete previousLoan._id;
            
            if (newRemarks.value == 'reloaner-wd' && currentCC.remarks.value == 'reloaner-cont') {
                const mcbuCol = currentCC.mcbuCol;
                const mcbu = currentLoan.mcbu - mcbuCol;

                previousLoan.mcbuCollection = mcbu;
                previousLoan.mcbuWithdrawal = mcbu;
                previousLoan.history.remarks = newRemarks;
                currentLoan.mcbu = 0;
                currentCC.mcbu = 0;
                currentCC.mcbuCol = 0;
                currentCC.mcbuWithdrawal = mcbu;
                currentCC.remarks = newRemarks;
            } else if  (newRemarks.value == 'reloaner-cont' && currentCC.remarks.value == 'reloaner-wd') {
                const excessMcbu = currentCC.excess / currentCC.activeLoan;
                const finalMcbu = (excessMcbu * 10) + 10;
                const mcbu = currentCC.mcbuWithdrawal + finalMcbu;

                previousLoan.mcbuCollection = mcbu;
                previousLoan.mcbuWithdrawal = 0;
                previousLoan.history.remarks = newRemarks;
                currentLoan.mcbu = mcbu;
                currentCC.mcbu = mcbu;
                currentCC.mcbuCol = finalMcbu;
                currentCC.mcbuWithdrawal = 0;
                currentCC.remarks = newRemarks;
            }

            await db.collection('loans').updateOne({_id: new ObjectId(loanId)}, {$set: {...currentLoan}});
            await db.collection('loans').updateOne({_id: previousLoanId}, {$set: {...previousLoan}});
            await db.collection('cashCollections').updateOne({_id: currentCCId}, {$set: {...currentCC}});
        }
    }


    response = { success: true };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}