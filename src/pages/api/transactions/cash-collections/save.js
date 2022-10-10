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
    const data = req.body;

    
    if (data.length > 0) {
        data.map(cc => {
            const clientData = findClient(ObjectId(cc.clientId));

            if (clientData.length === 0) {
                response = {
                    error: true,
                    fields: ['clientId'],
                    message: `Client not found`
                };
            } else {
                if (cc._id) {
                    updateCollection(cc);
                } else {
                    saveCollection(cc);
                }

                updateLoan(cc);
            }

            response = { success: true }
        });
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function findClient(clientId) {
    const { db } = await connectToDatabase();

    const client = await db
        .collection('client')
        .find({ _id: clientId, status: 'active' })
        .toArray();

    return client;
}

async function saveCollection(collection) {
    const { db } = await connectToDatabase();

    const cashCollection = await db.collection('cashCollections').insertOne({
        ...collection
    });

    return cashCollection;
}

async function updateCollection(collection) {
    const { db } = await connectToDatabase();

    const collectionId = collection._id;
    delete collection._id;
    // collection.dateModified = new Date();

    const cashCollection = await db.collection('cashCollections')
        .updateOne(
            { _id: ObjectId(collectionId) }, 
            {
                $set: { ...collection }
            }, 
            { upsert: false }
        );

    return cashCollection;
}

async function updateLoan(collection) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: ObjectId(collection.loanId) }).toArray();
    if (loan.length > 0) {
        loan = loan[0];
        if (collection.paymentCollection > 0) {
            loan.loanBalance = loan.loanBalance - collection.paymentCollection;
            loan.noOfPayments = loan.noOfPayments + 1;
        } else {
            loan.mispayments = loan.mispayments ? loan.mispayments + 1 : loan.mispayments;
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
}