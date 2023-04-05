import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateTransactionsSettings,
    get: getTransactionsSettings
});

async function getTransactionsSettings(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    const transactions = await db.collection('transactionSettings').find().toArray();

    response = {
        success: true,
        transactions: transactions[0]
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateTransactionsSettings(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const transactions = req.body;
    const transactionId = transactions._id;
    delete transactions._id;

    const transactionsResp = await db
        .collection('transactionSettings')
        .updateOne(
            { _id: new ObjectId(transactionId) }, 
            {
                $set: { ...transactions }
            }, 
            { upsert: true });

    response = { success: true, transactions: transactionsResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}