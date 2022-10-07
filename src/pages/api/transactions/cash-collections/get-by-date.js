import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';


export default apiHandler({
    get: getLoanByDate
});

async function getLoanByDate(req, res) {
    const { db } = await connectToDatabase();

    const { date, mode, branchId, loId, groupId } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;


    if (branchId) {
        cashCollection = await db
            .collection('cashCollections')
            .find({ dateAdded: date, mode: mode, branchId: branchId })
            .sort({ slotNo: 1 })
            .toArray();
    } else if (loId) {
        cashCollection = await db
            .collection('cashCollections')
            .find({ dateAdded: date, mode: mode, loId: loId })
            .sort({ slotNo: 1 })
            .toArray();
    } else if (groupId) {
        cashCollection = await db
            .collection('cashCollections')
            .find({ dateAdded: date, mode: mode, groupId: groupId })
            .sort({ slotNo: 1 })
            .toArray();
    } else {
        cashCollection = await db
            .collection('cashCollections')
            .find({ dateAdded: date, mode: mode })
            .sort({ slotNo: 1 })
            .toArray();
    }

        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}