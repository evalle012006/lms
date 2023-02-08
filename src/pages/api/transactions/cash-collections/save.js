import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

const currentDate = moment(new Date()).format('YYYY-MM-DD');

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
                if (collection.hasOwnProperty('_id')) {
                    if (collection.remarks && collection.remarks.value === "delinquent") {
                        collection.targetCollection = 0;
                    }

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

                // saveCollection(collection).then(respCollection => {
                //     if (respCollection.success && (cc.status === "active" || cc.status === "completed" || cc.status === "closed")) {
                //         updateLoan(collection).then(respLoan => {
                //             if (respLoan.success) {
                //                 updateClient(collection);
                //             }
                //         });
                //     }
                // });
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
        await db.collection('cashCollections')
            .updateOne(
                { _id: ObjectId(collection.collectionId)},
                {
                    $set: {...collection}
                },
                { upsert: false }
            );
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
        
        if (collection.remarks && collection.remarks.value === "past due") {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue + 1 : 1;
        } else {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue : 0;
        }
        // loan.prevData = collection.prevData;

        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        if (collection.loanBalance <= 0) {
            loan.status = 'completed';
            loan.fullPaymentDate = collection.fullPaymentDate;
            loan.history = {};
            loan.history = collection.history;
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

// async function saveUpdateTotals (total) {
//     const { db } = await connectToDatabase();

//     delete total.slotNo;
//     delete total.fullName;
//     delete total.loanCycle;
//     delete total.remarks;
//     delete total.clientStatus;
//     delete total.status;
//     delete total.noOfPayments;

//     const currentTotal = await db.collection('cashCollectionTotals').find({ dateAdded: currentDate, loId: total.loId, groupId: total.groupId }).toArray();

//     if (currentTotal.length > 0) {
//         total.dateModified = currentDate;
//         await db.collection('cashCollectionTotals').updateOne({ _id: currentTotal[0]._id }, { $set: { ...total } }, { upsert: false });
//     } else {
//         total.dateAdded = currentDate;
//         await db.collection('cashCollectionTotals').insertOne({ ...total });
//     }
// }