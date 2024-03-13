import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';
import logger from '@/logger';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    let response = {};
    let statusCode = 200;
    let data = req.body;
    const currentDate = data.currentDate;
    const currentTime = data.currentTime;
    data.collection = JSON.parse(data.collection);
    if (data.collection.length > 0) {
        let existCC = [];
        let newCC = [];
        // let prevCommpleted = [];
        logger.debug({page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`});
        data.collection.map(async cc => {
            if (cc.status !== "totals") {
                let collection = {...cc};
                delete collection.reverted;

                const timeArgs = currentTime.split(" ");
                // put this in the config settings should be by hour and minute?
                collection.latePayment = (timeArgs[1] == 'PM' && timeArgs[0].startsWith('6')) ? true : false;
                collection.timeAdded = currentTime;

                if (cc.occurence === "weekly") {
                    if (collection.remarks && (collection.remarks.value?.startsWith('excused-') || collection.remarks.value === 'delinquent')) {
                        collection.mcbuTarget = 0;
                    } else {
                        collection.mcbuTarget = 50;
                    }
                }

                if (collection.status === 'completed' && collection.loanBalance <= 0 && collection?.remarks?.value !== 'offset-matured-pd') {
                    collection.pastDue = 0;
                }

                if (collection.loanBalance <= 0) {
                    if (collection.occurence == 'daily') {
                        collection.noOfPayments = 60;
                    } else {
                        collection.noOfPayments = 24;
                    }
                }
                
                if (collection.status === 'completed' || (collection.status == 'pending' && collection.loanCycle > 1) || collection.status === 'closed') {
                    collection.fullPaymentDate = (collection.fullPaymentDate || collection.fullPaymentDate == "") ? collection.fullPaymentDate : currentDate;
                }

                if (collection.status === 'completed' && (collection?.remarks?.value?.startsWith('offset') || collection.mcbuReturnAmt > 0)) {
                    collection.status = "closed";
                }
                logger.debug({page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`, currentDate: currentDate, data: collection});
                if (collection.hasOwnProperty('_id')) {
                    collection.modifiedDateTime = new Date();
                    const existCollection = {...collection};
                    delete existCollection.mcbuHistory;
                    existCC.push(collection);
                } else {
                    // if (collection.status === 'completed' && collection?.previousDraft) {
                    //     prevCommpleted.push(collection);
                    // } else {
                        collection.insertedDateTime = new Date();
                        const newCollection = {...collection};
                        delete newCollection.mcbuHistory;
                        newCC.push(collection);
                    // }
                }
                
                if (collection.status !== "tomorrow" && collection.status !== "pending" && !collection.draft) {
                    await updateLoan(db, collection, currentDate)
                    await updateClient(db, collection, currentDate);
                }

                if (collection.status === 'pending' && collection?.advance) {
                    collection = await updatePendingLoan(db, collection, currentDate);
                }
            }
        });

        if (newCC.length > 0) {
            await saveCollection(db, newCC);
        }

        if (existCC.length > 0) {
            await updateCollection(db, existCC);
        }

        // if (prevCommpleted.length > 0) {
        //     await updateCompletedCollection(prevCommpleted);
        // }
    }

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveCollection(db, collections) {
    await db.collection('cashCollections')
        .insertMany(collections);
}

async function updateCollection(db, collections) {
    const ObjectId = require('mongodb').ObjectId;

    collections.map(async collection => {
        const collectionId = collection._id;
        delete collection._id;
        if (collection?.origin === 'pre-save') {
            delete collection.origin;
            await db.collection('cashCollections')
                .updateOne(
                    { _id: new ObjectId(collectionId)},
                    {
                        $unset: { origin: 1, reverted: 1 },
                        $set: {...collection}
                    },
                    { upsert: false }
                );
        } else {
            await db.collection('cashCollections')
                .updateOne(
                    { _id: new ObjectId(collectionId)},
                    {
                        $unset: { origin: 1, reverted: 1 },
                        $set: {...collection}
                    },
                    { upsert: false }
                );
        }
    });
}

async function updateLoan(db, collection, currentDate) {
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: new ObjectId(collection.loanId) }).toArray();
    logger.debug({page: `Saving Cash Collection - Updating Loan: ${collection.loanId}`});
    if (loan.length > 0) {
        loan = loan[0];
        delete loan.groupStatus;
        loan.loanBalance = collection.loanBalance;
        loan.modifiedDateTime = new Date();

        if (collection?.revertedDate) {
            loan.revertedDate = collection.revertedDate;
        }

        if (collection.remarks && (!collection.remarks.value?.startsWith('excused')  && collection.remarks.value !== 'delinquent')) {
            loan.activeLoan = collection.activeLoan;
        }

        if (collection.remarks && collection.remarks.value === 'matured-past due') {
            loan.activeLoan = 0;
            loan.maturedPD = true;
            loan.maturedPDDate = currentDate;
        }
        
        loan.amountRelease = collection.amountRelease;
        loan.noOfPayments = collection.noOfPayments !== '-' ? collection.noOfPayments : 0;
        // loan.fullPaymentDate = '';
        loan.status = collection.status;
        loan.pastDue = collection.pastDue;
        loan.advanceDays = collection?.advanceDays ? collection.advanceDays : 0;

        loan.mcbuTarget = collection.mcbuTarget;
        loan.mcbu = collection.mcbu < 0 ? 0 : collection.mcbu;
        if (!loan.mcbuCollection || loan.mcbuCollection < 0) {
            loan.mcbuCollection = 0;
        }
        loan.mcbuCollection = loan.mcbuCollection ? loan.mcbuCollection + parseFloat(collection.mcbuCol) : parseFloat(collection.mcbuCol);

        if (loan.occurence == 'daily' && collection.remarks) {
            if (collection.remarks.value == 'reloaner-wd') {
                loan.mcbuWithdrawal = collection.mcbuWithdrawal;
            } else if (collection.remarks.value == 'reloaner-cont') {
                loan.mcbuWithdrawal = 0;
            }
        } else {
            loan.mcbuWithdrawal = loan.mcbuWithdrawal ? loan.mcbuWithdrawal + parseFloat(collection.mcbuWithdrawal) : collection.mcbuWithdrawal ? parseFloat(collection.mcbuWithdrawal) : 0;
        }

        if (collection.hasOwnProperty('mcbuInterest')) {
            loan.mcbuInterest = loan.mcbuInterest ? loan.mcbuInterest + collection.mcbuInterest : collection.mcbuInterest !== '-' ? collection.mcbuInterest : 0;
        }
        
        if (collection.remarks && collection.remarks.value === "past due") {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue + 1 : 1;
        } else {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue : 0;
        }

        if (collection.mcbuInterest > 0) {
            loan.mcbuInterest = collection.mcbuInterest;
        }

        if (collection.mcbuReturnAmt > 0) {
            loan.mcbuReturnAmt = collection.mcbuReturnAmt;
        } else {
            loan.mcbuReturnAmt = 0;
        }

        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        if (collection.hasOwnProperty('maturedPastDue')) {
            loan.maturedPastDue = collection.maturedPastDue;
            loan.mispayment = 0;
        }

        loan.history = collection.history;

        if (collection.loanBalance <= 0) {
            loan.status = collection.status;
            if (collection.status === 'tomorrow') {
                loan.status = 'active';
            }
            
            loan.activeLoan = 0;
            loan.fullPaymentDate = collection.fullPaymentDate;
            loan.amountRelease = 0;
            if (collection?.remarks?.value !== 'offset-matured-pd') {
                loan.noPastDue = 0;
                loan.pastDue = 0;
            }
        }

        loan.lastUpdated = currentDate;
        logger.debug({page: `Saving Cash Collection - Updating Loan`, data: loan});
        delete loan._id;
        await db.collection('loans').updateOne(
            { _id: new ObjectId(collection.loanId) }, 
            {
                $set: { ...loan },
                $unset: { reverted: 1 }
            }
        );

        return { success: true }
    }
}

async function updatePendingLoan(db, collection, currentDate) {
    const ObjectId = require('mongodb').ObjectId;
    logger.debug({page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentDate: currentDate});
    let currentLoan = await db.collection('loans').find({ _id: new ObjectId(collection.loanId) }).toArray();
    let pendingLoan = await db.collection('loans').find({ clientId: collection.clientId, status: 'pending' }).toArray();
    // let cashCollection = await db.collection('cashCollections').find({ clientId: collection.clientId, dateAdded: currentDate }).toArray();
    logger.debug({page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentLoanSize: currentLoan.length, pendingLoanSize: pendingLoan.length});
    if (currentLoan.length > 0 && pendingLoan.length > 0) {
        currentLoan = currentLoan[0];
        pendingLoan = pendingLoan[0];
        // cashCollection = cashCollection[0];

        currentLoan.status = 'closed';
        currentLoan.loanBalance = 0;
        currentLoan.amountRelease = 0;
        currentLoan.activeLoan = 0;
        currentLoan.mcbu = 0;
        currentLoan.mcbuCollection = collection.mcbu;
        currentLoan.noOfPayments = collection.noOfPayments;
        currentLoan.fullPaymentDate = collection.fullPaymentDate ? collection.fullPaymentDate : currentDate;
        currentLoan.mcbuWithdrawal = collection.mcbuWithdrawal > 0 ? collection.mcbuWithdrawal : 0;
        currentLoan.mcbuReturnAmt = collection.mcbuReturnAmt > 0 ? collection.mcbuReturnAmt : 0;
        currentLoan.history = collection.history;

        if (collection.remarks && (collection.remarks.value == 'reloaner-cont' || collection.remarks.value == 'reloaner')) {
            pendingLoan.mcbu = collection.mcbu;
        }

        pendingLoan.prevLoanFullPaymentDate = currentDate;
        pendingLoan.prevLoanFullPaymentAmount = collection.fullPayment;
        collection.loanId = pendingLoan._id + "";
        collection.currentReleaseAmount = pendingLoan.amountRelease;
        collection.prevLoanId = currentLoan._id + "";

        const currentLoanId = currentLoan._id;
        const pendingLoanId = pendingLoan._id;
        // const cashCollectionId = cashCollection._id;
        delete currentLoan._id;
        delete pendingLoan._id;
        // delete cashCollection._id;
        logger.debug({page: `Saving Cash Collection - Updating Pending Loan`, currentLoan: currentLoan, pendingLoan: pendingLoan, cashCollection: collection});
        await db.collection('loans').updateOne({ _id: currentLoanId}, { $set: { ...currentLoan } });
        await db.collection('loans').updateOne({ _id: pendingLoanId}, { $set: { ...pendingLoan } });
        // await db.collection('cashCollections').updateOne({ _id: cashCollectionId}, { $set: { ...cashCollection } });
    }
    return collection;
}

async function updateClient(db, loan, currentDate) {
    const ObjectId = require('mongodb').ObjectId;

    let client = await db.collection('client').find({ _id: new ObjectId(loan.clientId) }).toArray();

    if (client.length > 0) {
        client = client[0];

        client.status = loan.clientStatus;

        if (client.status === 'offset') {
            client.oldLoId = client.loId;
            client.oldGroupId = client.groupId;
            client.groupId = null;
            client.loId = null;
        }

        // let mcbuHistory = [];
        // const currentMonth = moment(currentDate).month() + 1;
        // const currentYear = moment(currentDate).year();
        // if (client.hasOwnProperty('mcbuHistory')) {
        //     mcbuHistory = [...client.mcbuHistory];
        //     const yearIndex = mcbuHistory.findIndex(h => h.year === currentYear);
        //     if (yearIndex > -1) {
        //         let mcbuMonths = mcbuHistory[yearIndex].mcbuMonths;
        //         const monthIndex = mcbuMonths.findIndex(m => m.month === currentMonth);
        //         if (monthIndex > -1) {
        //             let mcbuMonth = {...mcbuMonths[monthIndex]};
        //             mcbuMonth.mcbu = loan.mcbu;
        //             mcbuMonths[monthIndex] = mcbuMonth;
        //         } else {
        //             mcbuMonths.push({ month: currentMonth, mcbu: loan.mcbu });
        //         }

        //         mcbuHistory[yearIndex] = mcbuMonths;
        //     } else {
        //         mcbuHistory.push({ year: currentYear, mcbuMonths: [ {month: currentMonth, mcbu: loan.mcbu} ] });
        //     }
        // } else {
        //     mcbuHistory.push({ year: currentYear, mcbuMonths: [ {month: currentMonth, mcbu: loan.mcbu} ] });
        // }

        // client.mcbuHistory = mcbuHistory;

        if (loan.remarks && loan.remarks.value?.startsWith('delinquent')) {
            client.delinquent = true;
        }

        await db
            .collection('client')
            .updateOne(
                { _id: new ObjectId(loan.clientId) }, 
                {
                    $set: { ...client }
                }, 
                { upsert: false });
        
        if (loan.remarks && loan.remarks.value?.startsWith('offset')) {
            await updateLoanClose(db, loan, currentDate);
            await updateGroup(db, loan);
        }
    }
}

async function updateLoanClose(db, loanData, currentDate) {
    const ObjectId = require('mongodb').ObjectId;
    logger.debug({page: `Saving Cash Collection - Updating Loan Close`});
    let loan = await db.collection('loans').find({ _id: new ObjectId(loanData.loanId) }).toArray();
    logger.debug({page: `Saving Cash Collection - Updating Loan Close`, loanSize: loan.length});
    if (loan.length > 0) {
        loan = loan[0];

        loan.loanCycle = 0;
        loan.remarks = loanData.closeRemarks;
        loan.status = 'closed';
        loan.closedDate = currentDate;
        loan.dateModified = currentDate;
        delete loan._id;
        logger.debug({page: `Saving Cash Collection - Updating Loan Close`, data: loan});
        await db
            .collection('loans')
            .updateOne(
                { _id: new ObjectId(loanData.loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
    }
}

async function updateGroup(db, loan) {
    const ObjectId = require('mongodb').ObjectId;
    let group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();

    if (group.length > 0) {
        group = group[0];

        if (group.status === 'full') {
            group.status = 'available';
        }

        const slotNo = parseInt(loan.slotNo)
        if (!group.availableSlots.includes(slotNo)) {
            group.availableSlots.push(slotNo);
            group.availableSlots.sort((a, b) => { return a - b; });
            group.noOfClients = group.noOfClients - 1;
        } else {
            const index = group.availableSlots.indexOf(slotNo);
            if (index > -1) {
                group.availableSlots.splice(index, slotNo);
                group.availableSlots.sort((a, b) => { return a - b; });
                group.noOfClients = group.noOfClients + 1;
            }
        }

        // group.submitted = true;

        delete group._id;
        await db.collection('groups').updateOne(
            {  _id: new ObjectId(loan.groupId) },
            {
                $set: { ...group }
            }, 
            { upsert: false }
        );
    }
}