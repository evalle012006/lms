import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateLoanData
});

async function updateLoanData(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let statusCode = 200;
    let response = {};

    const cashCollections = await db.collection('cashCollections').find({ dateAdded: "2023-11-22", "remarks.value": "matured-past due" }).toArray();

    cashCollections.map(async cc => {
        await db.collection('loans').updateOne({ _id: new ObjectId(cc.loanId) }, {$set: {maturedPD: true, maturedPDDate: "2023-11-22"}});
    });
    
    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}