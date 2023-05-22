import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: processLOSummary
});

async function processLOSummary(req, res) {
    const { db } = await connectToDatabase();
    const { loId, mode, currentDate } = req.body;

    if (loId) {
        const result = await db.collection('cashCollections').updateMany(
            {
                loId: loId,
                dateAdded: currentDate
            }, {
                $set: { groupStatus: mode === 'close' ? 'closed' : 'pending' }
            });

        if (result.modifiedCount === 0) {
            response = { error: true, message: "No transactions found for this Loan Officer." };
        } else {
            response = { success: true };
        }
    } else {
        response = { error: true, message: "Loan Office Id not found." };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}