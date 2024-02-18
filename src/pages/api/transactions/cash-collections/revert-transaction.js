import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate, getEndDate, getPrevousWorkday } from '@/lib/utils';
import logger from '@/logger';
import moment from 'moment'

export default apiHandler({
    post: revert,
});

let statusCode = 200;
let response = {};

async function revert(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const cashCollections = req.body;

    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(cashCollections.map(async (cc) => {
            let cashCollection = {...cc};

            let loanId = cashCollection.loanId;
            let cashCollectionId = cashCollection._id;
            if (cashCollection.status == 'closed') {
                loanId = cashCollection._id;
                const closedCC = cashCollection?.current[0];
                cashCollectionId = closedCC._id;
            }

            let client = await db.collection('client').find({ _id: new ObjectId(cashCollection.clientId) }).toArray();
            let previousLoanId = cashCollection?.prevLoanId;
            let currentLoan = [];
            let previousLoan = [];

            if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
                previousLoan = await db.collection('loans').find({ _id: new ObjectId(previousLoanId) }).toArray();
            } else {
                currentLoan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
            }

            let previousCC = await db.collection("cashCollections").find({ clientId: cashCollection.clientId }).sort({ $natural: -1 }).limit(2).toArray();

            // if active and completed (should check for pending) - just sync the previous cc tranction and delete the current cc transaction
            // if pending and tomorrow - delete the currentLoan and delete the current cc transaction
            // if active: 
            //      loans.activeLoan = previousCC.activeLoan // check if greater than 0 else get it from history
            //      loans.amountRelease = previoucsCC.amountRelease;
            //      loans.loanBalance = previoucCC.loanBalance
            //      loans.mcbu = previousCC.mcbu; 
            //      loans.mcbuCollection = previousCC.mcbu; 
            //      loans.noOfPayments = previousCC.noOfPayments; 
            //      loans.advanceDays = previousCC.advanceDays;
            //      if delinquent or excused, loans.mispayment -= 1;
            //      loans.history = previousCC.history
            //      loans.status = active
            //      loans.fullPaymentDate = null
            // if closed:
            //      same above
            //      delete loans.closedDate
            //      delete loans.remarks
            //      set client status to active
            //      remove the slotNo in availableSlotNo in group and add 1 in noOfClient; if noOfClient = availableSlot set status to full

            if (client.length > 0 && previousCC.length == 2) {
                client = client[0];
                previousCC = previousCC[1];

                // delete current transaction
                await db.collection('cashCollections').deleteOne({ _id: new ObjectId(cashCollectionId) });

                if (previousLoan.length > 0) { // pending, tomorrow
                    previousLoan = previousLoan[0];
                    delete previousLoan._id;
                    await db.collection('loans').deleteOne({ _id: new ObjectId(loanId) });

                    previousLoan.activeLoan = previousCC.activeLoan > 0 ? previousCC.activeLoan : previousCC.history?.activeLoan;
                    previousLoan.amountRelease = previousCC.amountRelease;
                    previousLoan.loanBalance = previousCC.loanBalance;
                    previousLoan.mcbu = previousCC.mcbu;
                    previousLoan.mcbuCollection = previousCC.mcbu;
                    previousLoan.mcbuReturnAmt = 0;
                    previousLoan.mcbuWithdrawal = 0;
                    previousLoan.noOfPayments = previousCC.noOfPayments;
                    previousLoan.advanceDays = previousCC.advanceDays;
                    previousLoan.history = previousCC.history;
                    previousLoan.status = 'active';
                    previousLoan.fullPaymentDate = null;
                    previousLoan.reverted = true;
                    previousLoan.revertedDate = currentDate;

                    await db.collection('loans').updateOne({ _id: new ObjectId(previousLoanId) }, { $set: {...previousLoan} });
                } else if (currentLoan.length > 0) { // active, completed, closed
                    currentLoan = currentLoan[0];
                    delete currentLoan._id;

                    currentLoan.activeLoan = previousCC.activeLoan > 0 ? previousCC.activeLoan : previousCC.history?.activeLoan;
                    if (previousCC.status == 'completed') {
                        currentLoan.activeLoan = 0;
                    }
                    currentLoan.amountRelease = previousCC.status == 'completed' ? 0 : previousCC.amountRelease;
                    currentLoan.loanBalance = previousCC.status == 'completed' ? 0 : previousCC.loanBalance;
                    currentLoan.mcbu = previousCC.status == 'completed' ? currentLoan.mcbu : previousCC.mcbu;
                    currentLoan.mcbuCollection = previousCC.status == 'completed' ? currentLoan.mcbu : previousCC.mcbu;
                    currentLoan.mcbuReturnAmt = previousCC.status == 'completed' ? currentLoan.mcbuReturnAmt : 0;
                    currentLoan.mcbuWithdrawal = previousCC.status == 'completed' ? currentLoan.mcbuWithdrawal : 0;
                    currentLoan.noOfPayments = previousCC.noOfPayments;
                    currentLoan.advanceDays = previousCC.advanceDays;
                    currentLoan.history = previousCC.history;
                    currentLoan.status = previousCC.status == 'completed' ? 'completed' : 'active';
                    currentLoan.fullPaymentDate = previousCC.status == 'completed' ? previousCC.fullPaymentDate : null;
                    currentLoan.reverted = true;
                    currentLoan.revertedDate = currentDate;

                    if (cashCollection.status == 'closed') {
                        // update client
                        delete client._id;
                        client.status = 'active';
                        client.groupId = client.oldGroupId;
                        client.loId = client.oldLoId;
                        client.oldGroupId = null;
                        client.oldLoId =  null;
                        delete client.oldGroupId;
                        delete client.oldLoId;
                        await db.collection('client').updateOne({ _id: new ObjectId(cashCollection.clientId) }, { $unset: { oldGroupId: 1, oldLoId: 1 }, $set: { ...client } });

                        // update group
                        let group = {...cashCollection.group};
                        group.availableSlots = group.availableSlots.filter(s => s !== cashCollection.slotNo);
                        group.noOfClients = group.noOfClients + 1;
                        if (group.noOfClients == group.noOfClients) {
                            group.status = 'full';
                        } else {
                            group.status = 'available';
                        }
                        const groupId = group._id;
                        delete group._id;
                        await db.collection('groups').updateOne({ _id: new ObjectId(groupId) }, {$set: { ...group }});

                        // update loan
                        currentLoan.loanCycle = previousCC.loanCycle;
                        delete currentLoan.closedDate;
                        delete currentLoan.remarks;
                        await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $unset: { closedDate: 1, remarks: 1 }, $set: {...currentLoan} });
                    } else {
                        await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: {...currentLoan} });
                    }
                }
            }
        }));

        resolve(response);
    });

    if (promise) {
        response = { success: true };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// async function revert(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;
//     const cashCollection = req.body;
//     logger.debug({page: 'LOR', message: 'Revert Transaction', data: cashCollection});
//     let loanId = cashCollection.loanId;
//     if (cashCollection.status == 'closed') {
//         loanId = cashCollection._id;
//     }

//     let currentLoan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
//     let previousWorkday = getPrevousWorkday();
//     let yesterday = previousWorkday.format('YYYY-MM-DD');
//     let previousCC = await db.collection('cashCollections').find({ clientId: cashCollection.clientId, dateAdded: yesterday }).toArray();
    
//     // logger.debug({page: 'LOR', message: 'Revert Transaction', loanId: loanId, currentLoan: currentLoan, previousCC: previousCC});
//     if (currentLoan && currentLoan.length > 0) {
//         previousCC = previousCC.length > 0 ? previousCC[0] : null;
//         let data = {...cashCollection};
//         if (cashCollection.status == 'closed') {
//             data = cashCollection.current[0];
//         }
//         const cashCollectionId = data._id;
//         delete data.group;
//         delete data.client;
//         delete data._id;
//         currentLoan = currentLoan[0];
//         const currentLoanId = currentLoan._id;
//         delete currentLoan._id;
//         let history = data.history;
//         let prevData = data.prevData;
//         if (cashCollection.status == 'active' || cashCollection.status == 'completed' || cashCollection.status == 'closed') {
//             // loans
//             if (!cashCollection.mispayment) {
//                 currentLoan.mcbu = prevData.mcbu;
//                 currentLoan.loanBalance = history.loanBalance;
//                 currentLoan.activeLoan = history.activeLoan;
//                 currentLoan.amountRelease = history.amountRelease;
//                 currentLoan.noOfPayments = prevData.noOfPayments;
//                 currentLoan.advanceDays = prevData.advanceDays;
//                 currentLoan.mcbuCollection = data.mcbu - data.mcbuCol;
//                 currentLoan.status = history.loanBalance > 0 ? "active" : 'completed';
//                 currentLoan.mcbuWithdrawal = 0;
//                 currentLoan.mcbuInterest = currentLoan.mcbuInterest - cashCollection.mcbuInterest;
//                 currentLoan.fullPaymentDate = history.loanBalance > 0 ? null : currentLoan.fullPaymentDate;
//                 currentLoan.loanCycle = history.loanCycle;
//                 currentLoan.history = cashCollection.history;
//                 delete currentLoan.maturedPD;
//                 delete currentLoan.maturedPDDate;
//             }

//             if (cashCollection.remarks && cashCollection.remarks.value == 'past due collection') {
//                 currentLoan.pastDue = currentLoan.pastDue + data.paymentCollection;
//                 currentLoan.noPastDue = currentLoan.noPastDue + 1;
//             } else if (cashCollection.pastDue > 0) {
//                 currentLoan.pastDue = currentLoan.pastDue > 0 ? currentLoan.pastDue - data.pastDue : 0;
//                 currentLoan.noPastDue = currentLoan.noPastDue > 0 ? currentLoan.noPastDue - 1 : 0;
//             }

//             if (cashCollection.mispayment) {
//                 currentLoan.mispayment -= 1;
//                 data.noMispayment -= 1;
//             }

//             currentLoan.reverted = true;
//             logger.debug({page: 'LOR', message: 'Revert Transaction', _id: currentLoanId, currentLoan: currentLoan});
//             await db.collection('loans').updateOne({ _id: currentLoanId }, { $unset: {maturedPd: 1, maturedPDDate: 1}, $set: {...currentLoan} });

//             // cashCollections
//             if (!cashCollection.mispayment) {
//                 data.paymentCollection = 0;
//                 data.excused = false;
//                 data.remarks = "";
//                 data.excess = 0;
//                 data.mcbuCol = 0;
//                 data.mcbu = prevData.mcbu;
//                 data.advanceDays = prevData.advanceDays;
//             }

//             data.amountRelease = prevData.amountRelease;
//             data.loanBalance = prevData.loanBalance;
//             data.targetCollection = prevData.activeLoan;
//             data.activeLoan = prevData.activeLoan;
//             data.noOfPayments = prevData.noOfPayments;
//             data.total = 0;
//             data.excused = false;
//             data.error = false;
//             data.dcmc = false;
//             data.delinquent = false;
//             data.mcbuWithdrawal = 0;
//             data.mcbuReturnAmt = 0;
//             data.pastDue = 0;
//             data.status = data.loanBalance > 0 ? "active" : 'completed';
//             data.fullPaymentDate = data.loanBalance > 0 ? null : data.fullPaymentDate;
//             data.fullPayment = 0;
//             data.mispayment = false;
//             data.remarks = '';
//             data.mispaymentStr = "No";
//             data.mcbuInterest = 0;
//             data.reverted = true;
//             delete data.maturedPD;
//             delete data.maturedPDDate;
//             logger.debug({page: 'LOR', message: 'Revert Transaction', _id: cashCollectionId, currentCC: data});
//             await db.collection('cashCollections').updateOne({ _id: new ObjectId(cashCollectionId) }, {$unset: {maturedPd: 1, maturedPDDate: 1}, $set: { ...data }});
//         } else if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
//             history = previousCC?.history;
//             const prevLoanId = cashCollection.prevLoanId;
//             let prevLoan = await db.collection('loans').find({ _id: new ObjectId(prevLoanId) }).toArray();
//             if (prevLoan && prevLoan.length > 0) {
//                 prevLoan = prevLoan[0];
//                 // loans
//                 prevLoan.mcbu = prevData.mcbu;
//                 prevLoan.loanBalance = prevData.loanBalance;
//                 prevLoan.activeLoan = prevData.activeLoan;
//                 prevLoan.amountRelease = prevData.amountRelease;
//                 prevLoan.noOfPayments = prevData.noOfPayments;
//                 prevLoan.advanceDays = prevData.advanceDays;
//                 prevLoan.mcbuCollection = cashCollection.mcbu - cashCollection.mcbuCol;
//                 prevLoan.status = "active";
//                 prevLoan.mcbuWithdrawal = 0;
//                 prevLoan.fullPaymentDate = null;
//                 prevLoan.history = history;

//                 if (cashCollection.pastDue > 0) {
//                     prevLoan.pastDue = prevLoan.pastDue > 0 ? prevLoan.pastDue - cashCollection.pastDue : 0;
//                     prevLoan.noPastDue = prevLoan.noPastDue > 0 ? prevLoan.noPastDue - 1 : 0;
//                 }

//                 prevLoan.reverted = true;
//                 delete prevLoan._id;
//                 logger.debug({page: 'LOR', message: 'Revert Transaction', _id: currentLoanId, currentLoan: currentLoan, prevLoanId: prevLoanId, prevLoan: prevLoan});
//                 await db.collection('loans').updateOne({ _id: new ObjectId(prevLoanId) }, { $set: {...prevLoan} });
//                 await db.collection('loans').deleteOne({ _id: currentLoanId });

//                 // cashCollections
//                 data.loanId = prevLoanId;
//                 data.paymentCollection = 0;
//                 data.amountRelease = prevData.amountRelease;
//                 data.loanBalance = prevData.loanBalance;
//                 data.targetCollection = prevData.activeLoan;
//                 data.activeLoan = prevData.activeLoan;
//                 data.currentReleaseAmount = 0;
//                 data.excused = false;
//                 data.remarks = "";
//                 data.excess = 0;
//                 data.mcbuCol = 0;
//                 data.mcbu = prevData.mcbu;
//                 data.noOfPayments = prevData.noOfPayments;
//                 data.total = 0;
//                 data.advanceDays = prevData.advanceDays;
//                 data.pending = false;
//                 data.tomorrow = false;
//                 data.error = false;
//                 data.dcmc = false;
//                 data.delinquent = false;
//                 data.mcbuWithdrawal = 0;
//                 data.mcbuReturnAmt = 0;
//                 data.pastDue = 0;
//                 data.status = "active";
//                 data.fullPaymentDate = null;
//                 data.fullPayment = 0;
//                 data.mispayment = false;
//                 data.mispaymentStr = "No";
//                 data.loanCycle = data.loanCycle - 1;
//                 data.history = history;
//                 data.prevData = prevData;
//                 data.reverted = true;
//                 delete data.prevLoanId;
//                 logger.debug({page: 'LOR', message: 'Revert Transaction', _id: cashCollectionId, currentCC: data});
//                 await db.collection('cashCollections').updateOne({ _id: new ObjectId(cashCollectionId) }, {$set: { ...data }}, {$unset: {prevLoanId: 1}});
//             }
//         }

//         if (cashCollection.status === 'closed') {
//             let group = {...cashCollection.group};
//             group.availableSlots = group.availableSlots.filter(s => s !== cashCollection.slotNo);
//             group.noOfClients = group.noOfClients + 1;

//             const groupId = group._id;
//             delete group._id;
//             await db.collection('groups').updateOne({ _id: new ObjectId(groupId) }, {$set: { ...group }});
//         }

//         if (cashCollection.delinquent) {
//             // let client = {...cashCollection.client};
//             // client
//             // need to check the previous transactions if there is delinquent
//         }
//     }

//     response = { success: true };
//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }