import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getEndDate, getPrevousWorkday } from '@/lib/utils';
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
    logger.debug({page: 'LOR', message: 'Revert Transaction', data: cashCollection});
    let loanId = cashCollection.loanId;
    if (cashCollection.status == 'closed') {
        loanId = cashCollection._id;
    }

    let currentLoan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
    let previousWorkday = getPrevousWorkday();
    let yesterday = previousWorkday.format('YYYY-MM-DD');
    let previousCC = await db.collection('cashCollections').find({ clientId: cashCollection.clientId, dateAdded: yesterday }).toArray();
    
    // logger.debug({page: 'LOR', message: 'Revert Transaction', loanId: loanId, currentLoan: currentLoan, previousCC: previousCC});
    if (currentLoan && currentLoan.length > 0) {
        previousCC = previousCC.length > 0 ? previousCC[0] : null;
        let data = {...cashCollection};
        if (cashCollection.status == 'closed') {
            data = cashCollection.current[0];
        }
        const cashCollectionId = data._id;
        delete data.group;
        delete data.client;
        delete data._id;
        currentLoan = currentLoan[0];
        const currentLoanId = currentLoan._id;
        delete currentLoan._id;
        let history = data.history;
        let prevData = data.prevData;
        if (cashCollection.status == 'active' || cashCollection.status == 'completed' || cashCollection.status == 'closed') {
            // loans
            if (!cashCollection.mispayment) {
                currentLoan.mcbu = prevData.mcbu;
                currentLoan.loanBalance = history.loanBalance;
                currentLoan.activeLoan = history.activeLoan;
                currentLoan.amountRelease = history.amountRelease;
                currentLoan.noOfPayments = prevData.noOfPayments;
                currentLoan.advanceDays = prevData.advanceDays;
                currentLoan.mcbuCollection = data.mcbu - data.mcbuCol;
                currentLoan.status = history.loanBalance > 0 ? "active" : 'completed';
                currentLoan.mcbuWithdrawal = 0;
                currentLoan.fullPaymentDate = history.loanBalance > 0 ? null : currentLoan.fullPaymentDate;
                currentLoan.loanCycle = history.loanCycle;
                currentLoan.history = cashCollection.history;
            }

            if (cashCollection.remarks && cashCollection.remarks.value == 'past due collection') {
                currentLoan.pastDue = currentLoan.pastDue + data.paymentCollection;
                currentLoan.noPastDue = currentLoan.noPastDue + 1;
            } else if (cashCollection.pastDue > 0) {
                currentLoan.pastDue = currentLoan.pastDue > 0 ? currentLoan.pastDue - data.pastDue : 0;
                currentLoan.noPastDue = currentLoan.noPastDue > 0 ? currentLoan.noPastDue - 1 : 0;
            }

            if (cashCollection.mispayment) {
                currentLoan.mispayment -= 1;
                data.noMispayment -= 1;
            }

            currentLoan.reverted = true;
            logger.debug({page: 'LOR', message: 'Revert Transaction', _id: currentLoanId, currentLoan: currentLoan});
            await db.collection('loans').updateOne({ _id: currentLoanId }, { $set: {...currentLoan} });

            // cashCollections
            if (!cashCollection.mispayment) {
                data.paymentCollection = 0;
                data.excused = false;
                data.remarks = "";
                data.excess = 0;
                data.mcbuCol = 0;
                data.mcbu = prevData.mcbu;
                data.advanceDays = prevData.advanceDays;
            }

            data.amountRelease = prevData.amountRelease;
            data.loanBalance = prevData.loanBalance;
            data.targetCollection = prevData.activeLoan;
            data.activeLoan = prevData.activeLoan;
            data.noOfPayments = prevData.noOfPayments;
            data.total = 0;
            data.excused = false;
            data.error = false;
            data.dcmc = false;
            data.delinquent = false;
            data.mcbuWithdrawal = 0;
            data.mcbuReturnAmt = 0;
            data.pastDue = 0;
            data.status = data.loanBalance > 0 ? "active" : 'completed';
            data.fullPaymentDate = data.loanBalance > 0 ? null : data.fullPaymentDate;
            data.fullPayment = 0;
            data.mispayment = false;
            data.remarks = '';
            data.mispaymentStr = "No";
            data.reverted = true;
            logger.debug({page: 'LOR', message: 'Revert Transaction', _id: cashCollectionId, currentCC: data});
            await db.collection('cashCollections').updateOne({ _id: new ObjectId(cashCollectionId) }, {$set: { ...data }});
        } else if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
            history = previousCC?.history;
            const prevLoanId = cashCollection.prevLoanId;
            let prevLoan = await db.collection('loans').find({ _id: new ObjectId(prevLoanId) }).toArray();
            if (prevLoan && prevLoan.length > 0) {
                prevLoan = prevLoan[0];
                // loans
                prevLoan.mcbu = prevData.mcbu;
                prevLoan.loanBalance = prevData.loanBalance;
                prevLoan.activeLoan = prevData.activeLoan;
                prevLoan.amountRelease = prevData.amountRelease;
                prevLoan.noOfPayments = prevData.noOfPayments;
                prevLoan.advanceDays = prevData.advanceDays;
                prevLoan.mcbuCollection = cashCollection.mcbu - cashCollection.mcbuCol;
                prevLoan.status = "active";
                prevLoan.mcbuWithdrawal = 0;
                prevLoan.fullPaymentDate = null;
                prevLoan.history = history;

                if (cashCollection.pastDue > 0) {
                    prevLoan.pastDue = prevLoan.pastDue > 0 ? prevLoan.pastDue - cashCollection.pastDue : 0;
                    prevLoan.noPastDue = prevLoan.noPastDue > 0 ? prevLoan.noPastDue - 1 : 0;
                }

                prevLoan.reverted = true;
                delete prevLoan._id;
                logger.debug({page: 'LOR', message: 'Revert Transaction', _id: currentLoanId, currentLoan: currentLoan, prevLoanId: prevLoanId, prevLoan: prevLoan});
                await db.collection('loans').updateOne({ _id: new ObjectId(prevLoanId) }, { $set: {...prevLoan} });
                await db.collection('loans').deleteOne({ _id: currentLoanId });

                // cashCollections
                data.loanId = prevLoanId;
                data.paymentCollection = 0;
                data.amountRelease = prevData.amountRelease;
                data.loanBalance = prevData.loanBalance;
                data.targetCollection = prevData.activeLoan;
                data.activeLoan = prevData.activeLoan;
                data.currentReleaseAmount = 0;
                data.excused = false;
                data.remarks = "";
                data.excess = 0;
                data.mcbuCol = 0;
                data.mcbu = prevData.mcbu;
                data.noOfPayments = prevData.noOfPayments;
                data.total = 0;
                data.advanceDays = prevData.advanceDays;
                data.pending = false;
                data.tomorrow = false;
                data.error = false;
                data.dcmc = false;
                data.delinquent = false;
                data.mcbuWithdrawal = 0;
                data.mcbuReturnAmt = 0;
                data.pastDue = 0;
                data.status = "active";
                data.fullPaymentDate = null;
                data.fullPayment = 0;
                data.mispayment = false;
                data.mispaymentStr = "No";
                data.loanCycle = data.loanCycle - 1;
                data.history = history;
                data.prevData = prevData;
                data.reverted = true;
                delete data.prevLoanId;
                logger.debug({page: 'LOR', message: 'Revert Transaction', _id: cashCollectionId, currentCC: data});
                await db.collection('cashCollections').updateOne({ _id: new ObjectId(cashCollectionId) }, {$set: { ...data }}, {$unset: {prevLoanId: 1}});
            }
        }

        if (cashCollection.status === 'closed') {
            let group = {...cashCollection.group};
            group.availableSlots = group.availableSlots.filter(s => s !== cashCollection.slotNo);
            group.noOfClients = group.noOfClients + 1;

            const groupId = group._id;
            delete group._id;
            await db.collection('groups').updateOne({ _id: new ObjectId(groupId) }, {$set: { ...group }});
        }

        if (cashCollection.delinquent) {
            // let client = {...cashCollection.client};
            // client
            // need to check the previous transactions if there is delinquent
        }
    }

    response = { success: true };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}