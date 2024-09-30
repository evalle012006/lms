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

                if (collection.paymentCollection / collection.activeLoan > 1) {
                    collection.excess = collection.paymentCollection - collection.activeLoan;
                    if (collection.status == 'active') {
                        const excessPayment = collection.paymentCollection / collection.activeLoan;
                        collection.noOfPayments = collection.prevData?.noOfPayments ? collection.prevData?.noOfPayments + excessPayment : excessPayment;
                        collection.advanceDays = collection.prevData?.advanceDays ? collection.prevData?.advanceDays + excessPayment - 1 : excessPayment - 1;

                    } else {
                        collection.noOfPayments = collection.occurence == 'daily' ? 60 : 24;
                    }
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
                        delete collection._id;
                        collection.insertedDateTime = new Date();
                        collection.dateAdded = currentDate;
                        const newCollection = {...collection};
                        delete newCollection.mcbuHistory;
                        newCC.push(collection);
                    // }
                }
                
                if (collection.status !== "tomorrow" && collection.status !== "pending" && !collection.draft) {
                    await updateLoan(db, collection, currentDate)
                    await updateClient(db, collection, currentDate);
                }

                if ((collection.status == 'tomorrow' || collection.status == 'pending') && collection.mcbuWithdrawal > 0) {
                    await updateLoanMcbuWithdrawal(db, collection)
                }

                // if (collection.status === 'pending' && collection?.advance) {
                //     collection = await updatePendingLoan(db, collection, currentDate);
                // }
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

        // if (collection.remarks && (!collection.remarks.value?.startsWith('excused')  && collection.remarks.value !== 'delinquent')) {
        //     loan.activeLoan = collection.activeLoan;
        // }

        if (collection.remarks && collection.remarks.value === 'matured-past due') {
            loan.activeLoan = 0;
            loan.maturedPD = true;
            loan.maturedPDDate = currentDate;
        }
        
        loan.amountRelease = collection.amountRelease;
        loan.noOfPayments = collection.noOfPayments !== '-' ? collection.noOfPayments : 0;
        loan.status = collection.status;
        loan.pastDue = collection.pastDue;
        loan.advanceDays = collection?.advanceDays ? collection.advanceDays : 0;

        loan.mcbuTarget = collection.mcbuTarget;
        loan.mcbu = collection.mcbu < 0 ? 0 : collection.mcbu;
        if (!loan.mcbuCollection || loan.mcbuCollection < 0) {
            loan.mcbuCollection = 0;
        }
        loan.mcbuCollection = loan.mcbuCollection ? loan.mcbuCollection + parseFloat(collection.mcbuCol) : parseFloat(collection.mcbuCol);

        if (collection?.mcbuWithdrawal > 0) {
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

            if (collection.status == 'closed') {
                loan.loanCycle = 0;
                loan.remarks = collection.closeRemarks;
                loan.status = 'closed';
                loan.closedDate = currentDate;
                loan.dateModified = currentDate;
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

async function updateLoanMcbuWithdrawal(db, collection) {
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: new ObjectId(collection.loanId) }).toArray();
    logger.debug({page: `Saving Cash Collection - Updating Loan Due to Withdrawal: ${collection.loanId}`});
    if (loan.length > 0) {
        loan = loan[0];
        delete loan.groupStatus;
        
        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        loan.mcbu = collection.mcbu;
        loan.mcbuWithdrawal = collection.mcbuWithdrawal;

        logger.debug({page: `Saving Cash Collection - Updating Loan Due to Withdrawal`, data: loan});
        delete loan._id;
        await db.collection('loans').updateOne(
            { _id: new ObjectId(collection.loanId) }, 
            {
                $set: { ...loan }
            }
        );

        return { success: true }
    }
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
            // await updateLoanClose(db, loan, currentDate);
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