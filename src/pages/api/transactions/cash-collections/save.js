import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    post: save
});

async function save(req, res) {
    let response = {};
    let statusCode = 200;
    let data = req.body;
    const currentDate = data.currentDate;
    const currentTime = data.currentTime;
    data.collection = JSON.parse(data.collection);
    if (data.collection.length > 0) {
        let existCC = [];
        let newCC = [];
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

                if (collection.status === 'completed' && collection.loanBalance <= 0) {
                    collection.pastDue = 0;
                }

                if (collection.hasOwnProperty('_id')) {
                    collection.modifiedDateTime = new Date();
                    existCC.push(collection);
                } else {
                    collection.insertedDateTime = new Date();
                    newCC.push(collection);
                }

                if (collection.status !== "tomorrow" && collection.status !== "pending" && !collection.draft) {
                    await updateLoan(collection, currentDate)
                    await updateClient(collection, currentDate);
                }
            }
        });

        if (newCC.length > 0) {
            await saveCollection(newCC);
        }

        if (existCC.length > 0) {
            await updateCollection(existCC);
        }
    }

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveCollection(collections) {
    const { db } = await connectToDatabase();
    
    await db.collection('cashCollections')
        .insertMany(collections);
}

async function updateCollection(collections) {
    const { db } = await connectToDatabase();
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

async function updateLoan(collection, currentDate) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: new ObjectId(collection.loanId) }).toArray();
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
        
        loan.amountRelease = collection.amountRelease;
        loan.noOfPayments = collection.noOfPayments !== '-' ? collection.noOfPayments : 0;
        loan.fullPaymentDate = '';
        loan.status = collection.status;
        loan.pastDue = collection.pastDue;
        loan.advanceDays = collection?.advanceDays ? collection.advanceDays : 0;

        loan.mcbuTarget = collection.mcbuTarget;
        loan.mcbu = collection.mcbu;
        loan.mcbuCollection = loan.mcbuCollection ? loan.mcbuCollection + parseFloat(collection.mcbuCol) : parseFloat(collection.mcbuCol);
        loan.mcbuWithdrawal = loan.mcbuWithdrawal ? loan.mcbuWithdrawal + parseFloat(collection.mcbuWithdrawal) : collection.mcbuWithdrawal ? parseFloat(collection.mcbuWithdrawal) : 0;

        if (collection.hasOwnProperty('mcbuInterest')) {
            loan.mcbuInterest = loan.mcbuInterest ? loan.mcbuInterest + collection.mcbuInterest : collection.mcbuInterest !== '-' ? collection.mcbuInterest : 0;
        }
        
        if (collection.remarks && collection.remarks.value === "past due") {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue + 1 : 1;
        } else {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue : 0;
        }

        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        loan.history = collection.history;

        if (collection.loanBalance <= 0) {
            loan.status = collection.status;
            if (collection.status === 'tomorrow') {
                loan.status = 'active';
            }
            
            loan.fullPaymentDate = collection.fullPaymentDate;
            loan.activeLoan = 0;
            loan.amountRelease = 0;
            loan.noPastDue = 0;
            loan.pastDue = 0;
        }

        loan.lastUpdated = currentDate;

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

async function updateClient(loan, currentDate) {
    const { db } = await connectToDatabase();
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

        let mcbuHistory = [];
        const currentMonth = moment(currentDate).month() + 1;
        const currentYear = moment(currentDate).year();
        if (client.hasOwnProperty('mcbuHistory')) {
            mcbuHistory = [...client.mcbuHistory];
            const yearIndex = mcbuHistory.findIndex(h => h.year === currentYear);
            if (yearIndex > -1) {
                let mcbuMonths = mcbuHistory[yearIndex].mcbuMonths;
                const monthIndex = mcbuMonths.findIndex(m => m.month === currentMonth);
                if (monthIndex > -1) {
                    let mcbuMonth = {...mcbuMonths[monthIndex]};
                    mcbuMonth.mcbu = loan.mcbu;
                    mcbuMonths[monthIndex] = mcbuMonth;
                } else {
                    mcbuMonths.push({ month: currentMonth, mcbu: loan.mcbu });
                }

                mcbuHistory[yearIndex] = mcbuMonths;
            } else {
                mcbuHistory.push({ year: currentYear, mcbuMonths: [ {month: currentMonth, mcbu: loan.mcbu} ] });
            }
        } else {
            mcbuHistory.push({ year: currentYear, mcbuMonths: [ {month: currentMonth, mcbu: loan.mcbu} ] });
        }

        client.mcbuHistory = mcbuHistory;

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
            await updateLoanClose(loan, currentDate);
            await updateGroup(loan);
        }
    }
}

async function updateLoanClose(loanData, currentDate) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    
    let loan = await db.collection('loans').find({ _id: new ObjectId(loanData.loanId) }).toArray();

    if (loan.length > 0) {
        loan = loan[0];

        loan.loanCycle = 0;
        loan.remarks = loanData.closeRemarks;
        loan.status = 'closed';
        loan.closedDate = currentDate;
        loan.dateModified = currentDate;
        delete loan._id;
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

async function updateGroup(loan) {
    const { db } = await connectToDatabase();
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