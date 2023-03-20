import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    let response = {};
    let statusCode = 200;
    let data = req.body;
    data.collection = JSON.parse(data.collection);
    if (data.collection.length > 0) {
        const groupHeaderId = data._id;
        let existCC = [];
        let newCC = [];
        data.collection.map(async cc => {
            if (cc.status !== "totals") {
                let collection = {...cc, groupCollectionId: groupHeaderId};

                if (cc.status !== 'offset' || ((cc.remarks && (cc.remarks.value === 'reloaner' || cc.remarks.value === 'pending')) && cc.fullPaymentDate === currentDate)) {
                    if (cc.occurence === 'weekly') {
                        collection.mcbuTarget = collection.mcbuTarget ? collection.mcbuTarget + 50 : 50;
                    } else {
                        collection.mcbuTarget = collection.mcbuTarget ? collection.mcbuTarget + 10 : 10;
                    }
                }

                if (collection.hasOwnProperty('_id')) {
                    // if (collection.remarks && collection.remarks.value === "delinquent") {
                    //     collection.targetCollection = 0;
                    // }

                    collection.collectionId = collection._id;
                    delete collection._id;
                    existCC.push(collection);
                } else {
                    newCC.push(collection);
                }

                if (collection.status !== "pending") {
                    await updateLoan(collection)
                    await updateClient(collection);
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

        if (collection?.origin === 'pre-save') {
            delete collection.origin;
            await db.collection('cashCollections')
                .updateOne(
                    { _id: ObjectId(collection.collectionId)},
                    {
                        $unset: { origin: 1 },
                        $set: {...collection}
                    },
                    { upsert: false }
                );
        } else {
            await db.collection('cashCollections')
                .updateOne(
                    { _id: ObjectId(collection.collectionId)},
                    {
                        $set: {...collection}
                    },
                    { upsert: false }
                );
        }
    });
}

async function updateLoan(collection) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: ObjectId(collection.loanId) }).toArray();
    if (loan.length > 0) {
        loan = loan[0];

        loan.loanBalance = collection.loanBalance;
        loan.activeLoan = collection.activeLoan;
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
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        loan.history = collection.history;

        if (collection.loanBalance <= 0) {
            loan.status = 'completed';
            loan.fullPaymentDate = collection.fullPaymentDate;
            loan.activeLoan = 0;
            loan.amountRelease = 0;
        }

        loan.lastUpdated = currentDate;

        delete loan._id;
        await db.collection('loans').updateOne(
            { _id: ObjectId(collection.loanId) }, 
            {
                $set: { ...loan }
            }
        );

        return { success: true }
    }
}

async function updateClient(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let client = await db.collection('client').find({ _id: ObjectId(loan.clientId) }).toArray();

    if (client.length > 0) {
        client = client[0];

        client.status = loan.clientStatus;

        let mcbuHistory = [];
        const currentMonth = moment().month() + 1;
        const currentYear = moment().year();
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

        if (loan.remarks.value === 'delinquent') {
            client.delinquent = true;
        }

        await db
            .collection('client')
            .updateOne(
                { _id: ObjectId(loan.clientId) }, 
                {
                    $set: { ...client }
                }, 
                { upsert: false });
        
        if (loan.remarks.value === "offset") {
            await updateLoanClose(loan);
            await updateGroup(loan);
        }
    }
}

async function updateLoanClose(loanData) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    
    let loan = await db.collection('loans').find({ _id: ObjectId(loanData.loanId) }).toArray();

    if (loan.length > 0) {
        loan = loan[0];

        loan.loanCycle = 0;
        loan.remarks = loanData.closeRemarks;
        loan.status = 'closed';
        loan.dateModified = currentDate;
        delete loan._id;
        await db
            .collection('loans')
            .updateOne(
                { _id: ObjectId(loanData.loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
    }
}

async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let group = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();

    if (group.length > 0) {
        group = group[0];

        if (group.status === 'full') {
            group.status = 'available';
        }

        if (!group.availableSlots.includes(loan.slotNo)) {
            group.availableSlots.push(loan.slotNo);
            group.availableSlots.sort((a, b) => { return a - b; });
            group.noOfClients = group.noOfClients - 1;
        } else {
            const index = group.availableSlots.indexOf(loan.slotNo);
            if (index > -1) {
                group.availableSlots.splice(index, loan.slotNo);
                group.availableSlots.sort((a, b) => { return a - b; });
                group.noOfClients = group.noOfClients + 1;
            }
        }

        delete group._id;
        await db.collection('groups').updateOne(
            {  _id: ObjectId(loan.groupId) },
            {
                $set: { ...group }
            }, 
            { upsert: false }
        );
    }
}