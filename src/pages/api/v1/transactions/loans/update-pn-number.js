import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: updateLoan
});

async function updateLoan(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const { loanId, branchId, pnNumber } = req.body;
    logger.debug({page: `Updating PN Number`, loanId: loanId, branchId: branchId, pnNumber: pnNumber});
    const currentLoan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
    const exist = await db.collection('loans').find( { branchId: branchId, pnNumber: pnNumber, status: "active" } ).toArray();
    
    if (currentLoan.length === 0 ) {
        response = { error: true, message: 'No Active Loan associated to this client.' };
    } else if (exist.length > 0) {
        response = { error: true, message:  "PN Number already in used." };
    } else {
        let loan = currentLoan[0];
        loan.pnNumber = pnNumber;
        logger.debug({page: `Updating PN NUmber`, data: loan});
        delete loan._id;
        const resp = await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: { ...loan } });

        response = { success: true, response: resp };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}