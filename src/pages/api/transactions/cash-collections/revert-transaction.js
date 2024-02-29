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

            if ((cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') && cashCollection.loanCycle > 1) {
                previousLoan = await db.collection('loans').find({ _id: new ObjectId(previousLoanId) }).toArray();
            } else {
                currentLoan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
            }

            let previousCC = await db.collection("cashCollections").find({ clientId: cashCollection.clientId }).sort({ $natural: -1 }).limit(2).toArray();

            // NEED TO ACCOMODATE REVERT FOR NEW CLIENT PENDING/TOMORROW
            // - delete cashcollection
            // - set loan to rejected
            console.log(cc.slotNo, client.length, previousCC.length, currentLoan.length)
            if (client.length > 0 && previousCC.length == 2) {
                client = client[0];
                previousCC = previousCC[1];
                // delete current transaction
                await db.collection('cashCollections').deleteOne({ _id: new ObjectId(cashCollectionId) });

                if (previousLoan.length > 0) { // pending, tomorrow
                    console.log(cc.slotNo, 'aa')
                    previousLoan = previousLoan[0];
                    delete previousLoan._id;
                    await db.collection('loans').deleteOne({ _id: new ObjectId(loanId) });

                    if (previousCC.status == 'completed') {
                        console.log(cc.slotNo, 'bb')
                        previousLoan.activeLoan = 0;
                        previousLoan.amountRelease = 0;
                        previousLoan.loanBalance = 0;
                        previousLoan.mcbu = previousCC.mcbu;
                        previousLoan.mcbuCollection = previousCC.mcbu;
                        previousLoan.mcbuReturnAmt = 0;
                        previousLoan.mcbuWithdrawal = 0;
                        previousLoan.noOfPayments = previousCC.noOfPayments;
                        previousLoan.advanceDays = 0;
                        previousLoan.history = previousCC.history;
                        previousLoan.status = 'completed';
                    } else if (previousCC.status == 'closed') {
                        // do nothing
                    } else if (previousCC.status == 'pending') {
                        // do nothing
                    } else {
                        console.log(cc.slotNo, 'dd')
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
                    }
                    
                    if (previousCC.status !== 'closed') {
                        console.log(cc.slotNo, 'ee')
                        previousLoan.reverted = true;
                        previousLoan.revertedDate = currentDate;
                        delete previousLoan.advance;
                        delete previousLoan.advanceDate;

                        await db.collection('loans').updateOne({ _id: new ObjectId(previousLoanId) }, { $unset: {advance: 1, advanceDate: 1}, $set: {...previousLoan} });
                    }
                } else if (currentLoan.length > 0) { // active, completed, closed
                    console.log(cc.slotNo, 'ff')
                    currentLoan = currentLoan[0];
                    delete currentLoan._id;

                    currentLoan.activeLoan = previousCC.activeLoan > 0 ? previousCC.activeLoan : previousCC.history?.activeLoan;

                    if (previousCC.status == 'tomorrow') {
                        console.log(cc.slotNo, 'gg')
                        if (currentLoan.loanCycle > 1) {
                            currentLoan.amountRelease = previousCC.currentReleaseAmount;
                            currentLoan.loanBalance = previousCC.currentReleaseAmount;
                            currentLoan.mcbu = 0;
                            currentLoan.mcbuCollection = 0;
                            currentLoan.mcbuReturnAmt = 0;
                            currentLoan.mcbuWithdrawal = 0;
                            currentLoan.noOfPayments = 0;
                            currentLoan.advanceDays = 0;
                            currentLoan.status = 'active';
                            currentLoan.fullPaymentDate = null;
                        } else {
                            console.log(cc.slotNo, 'hh')
                            delete currentLoan.startDate;
                            delete currentLoan.endDate;
                            currentLoan.status = 'pending';
                        }
                    } else if (previousCC.status == 'completed') {
                        console.log(cc.slotNo, 'ii')
                        currentLoan.activeLoan = 0;
                        currentLoan.amountRelease = 0;
                        currentLoan.loanBalance = 0;
                        currentLoan.mcbu = previousCC.mcbu;
                        currentLoan.mcbuCollection = previousCC.mcbu;
                        currentLoan.mcbuReturnAmt = previousCC.mcbuReturnAmt;
                        currentLoan.mcbuWithdrawal = previousCC.mcbuWithdrawal;
                        currentLoan.noOfPayments = previousCC.noOfPayments;
                        currentLoan.advanceDays = previousCC.advanceDays;
                        currentLoan.history = previousCC.history;
                        currentLoan.status = 'completed';
                        currentLoan.fullPaymentDate = previousCC.fullPaymentDate;
                    } else {
                        console.log(cc.slotNo, 'jj')
                        currentLoan.amountRelease = previousCC.amountRelease;
                        currentLoan.loanBalance = previousCC.loanBalance;
                        currentLoan.mcbu = previousCC.mcbu;
                        currentLoan.mcbuCollection = previousCC.mcbu;
                        currentLoan.mcbuReturnAmt = 0;
                        currentLoan.mcbuWithdrawal = 0;
                        currentLoan.noOfPayments = previousCC.noOfPayments;
                        currentLoan.advanceDays = previousCC.advanceDays;
                        currentLoan.history = previousCC.history;
                        currentLoan.status = 'active';
                        currentLoan.fullPaymentDate = null;
                    }

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
                        await updateGroup(db, cashCollection.group, cashCollection.slotNo);

                        // update loan
                        currentLoan.loanCycle = previousCC.loanCycle;
                        delete currentLoan.closedDate;
                        delete currentLoan.remarks;
                        await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $unset: { closedDate: 1, remarks: 1 }, $set: {...currentLoan} });
                    } else {
                        if (currentLoan.status == 'pending' && cc.status == 'tomorrow') {
                            console.log(cc.slotNo, 'kk')
                            await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $unset: {startDate: 1, endDate: 1}, $set: {...currentLoan} });
                        } else if (cc.status == 'pending') {
                            console.log(cc.slotNo, 'll')
                            await db.collection('loans').deleteOne({ _id: new ObjectId(loanId) });
                            await updateGroup(db, cashCollection.group, cashCollection.slotNo);
                        } else {
                            console.log(cc.slotNo, 'mm')
                            await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: {...currentLoan} });
                        }
                    }
                }
            } else if (client.length > 0 && previousCC.length == 1) {
                // this is for new client, balik clients
                previousCC = previousCC[0];
                currentLoan = currentLoan[0];
                console.log(currentLoan.slotNo, previousCC.status)
                // delete current transaction
                await db.collection('cashCollections').deleteOne({ _id: previousCC._id });
                await db.collection('loans').deleteOne({ _id: currentLoan._id });
                await updateGroup(db, cashCollection.group, currentLoan.slotNo);
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

async function updateGroup(db, groupData, slotNo) {
    let group = {...groupData};
    group.availableSlots = group.availableSlots.filter(s => s !== slotNo);
    group.noOfClients = group.noOfClients + 1;
    if (group.noOfClients == group.noOfClients) {
        group.status = 'full';
    } else {
        group.status = 'available';
    }
    const groupId = group._id;
    delete group._id;
    await db.collection('groups').updateOne({ _id: new ObjectId(groupId) }, {$set: { ...group }});
}