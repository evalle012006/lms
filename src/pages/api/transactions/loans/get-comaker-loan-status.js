import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: getLoan
});

async function getLoan(req, res) {
    const { db } = await connectToDatabase();
    const { clientIdList } = req.body;
    let statusCode = 200;
    let response = {};
    const loanStatus = [];

    clientIdList.map(async (client) => {
        const loan = await db
            .collection('loans')
            .find({ clientId: client.coMaker })
            .toArray();

        if (loan) {
            const latestLoan = loan[loan.length - 1];
            loanStatus.push({ clientId: latestLoan.clientId, status: latestLoan.status, slotNo: client.slotNo });
        }
    });
        
    response = { success: true, data: loanStatus };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}