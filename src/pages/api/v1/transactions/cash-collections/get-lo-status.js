import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;


export default apiHandler({
    get: getLOStatus
});

async function getLOStatus(req, res) {
    const { db } = await connectToDatabase();

    const { loId, currentDate } = req.query;

    const cashCollections = await db.collection('cashCollections').find({ $expr: { $and: [ {$eq: ['$loId', loId]}, {$eq: ['$dateAdded', currentDate]} ] } }).toArray();

    let status = 'closed';
    if (cashCollections.length == 0) {
        status = 'open';
    } else {
        const pendingCC = cashCollections.filter(cc => cc.status == 'pending');
        if (pendingCC.length > 0) {
            status = 'open';
        }
    }

    response = { success: true, status: status };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}