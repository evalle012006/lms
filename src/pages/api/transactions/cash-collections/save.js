import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';


export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response = {};
    let statusCode = 200;
    let data = req.body;
    data.collection = JSON.parse(data.collection);
    if (data.collection.length > 0) {
        data.collection.map(cc => {
            updateLoan(cc).then(resp => {
                if (resp.success) {
                    if (typeof cc.remarks === 'object') {
                        if (cc.remarks.value === 'offset') {
                            updateClient(cc);
                        }
                    }
                }
            });
        });
    }

    let cashCollection;
    if (!data._id) {
        cashCollection = await db.collection('cashCollections').insertOne({
            ...data
        });
    } else {
        const collectionId = data._id;
        delete data._id;

        cashCollection = await db.collection('cashCollections')
            .updateOne(
                { _id: ObjectId(collectionId) }, 
                {
                    $set: { ...data }
                }, 
                { upsert: false }
            );
    }

    response = {success: true, data: cashCollection};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
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
        loan.noOfPayments = collection.noOfPayments;
        loan.fullPaymentDate = '';
        loan.history = {};
        loan.status = collection.status;
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        if (collection.loanBalance <= 0) {
            loan.status = 'completed';
            loan.fullPaymentDate = moment(new Date()).format('YYYY-MM-DD');
            loan.history = collection.history;
            // so that it will not be added in group summary
            loan.activeLoan = 0;
            loan.amountRelease = 0;
            // updateGroup(loan);
        }

        // check if client is closed and update it
        if (collection.clientStatus === 'offset') {
            updateClient(collection);
        }

        loan.lastUpdated = moment().format('YYYY-MM-DD');

        delete loan._id;
        await db.collection('loans').updateOne(
            { _id: ObjectId(collection.loanId) }, 
            {
                $set: { ...loan }
            }, 
            { upsert: false }
        );
    }

    return { success: true }
}

async function updateClient(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let client = await db.collection('client').find({ _id: ObjectId(loan.clientId) }).toArray();

    if (client.length > 0) {
        client = client[0];

        client.status = loan.clientStatus;

        const clientResp = await db
            .collection('client')
            .updateOne(
                { _id: ObjectId(loan.clientId) }, 
                {
                    $set: { ...client }
                }, 
                { upsert: false });
        
        if (loan.clientStatus === 'offset') {
            updateLoanClose(loan);
        }
        
        updateGroup(loan);
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
        loan.dateModified = moment(new Date()).format('YYYY-MM-DD');
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

// async function updateGroup(loan) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let group = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();
//     if (group.length > 0) {
//         group = group[0];

//         if (group.status === 'full') {
//             group.status = 'available';
//         }

//         group.availableSlots.push(loan.slotNo);
//         group.availableSlots.sort((a, b) => { return a - b; });
//         group.noOfClients = group.noOfClients - 1;

//         delete group._id;
//         await db.collection('groups').updateOne(
//             {  _id: ObjectId(loan.groupId) },
//             {
//                 $set: { ...group }
//             }, 
//             { upsert: false }
//         );
//     }
// }