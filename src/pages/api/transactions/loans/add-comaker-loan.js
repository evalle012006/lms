import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

let response = {};
let statusCode = 200;


export default apiHandler({
    post: syncLoans
});

async function syncLoans(req, res) {
    const { db } = await connectToDatabase();

    const { clientId, coMaker, groupId } = req.body;
    const currentLoan = await db.collection('loans').find({ status: 'active', clientId: clientId }).toArray();
    const coMakerLoan = await db.collection('loans').find({ status: 'active', slotNo: coMaker, groupId: groupId }).toArray();
    
    if (currentLoan.length === 0 ) {
        response = { error: true, message: 'No Active Loan associated to this client.' };
    } else if (coMakerLoan.length === 0) {
        response = { error: true, message: 'Selected CoMaker does not exist.' };
    } else {
        let loan = currentLoan[0];
        const cmLoan = coMakerLoan[0];
        loan.coMaker = coMaker;
        loan.coMakerId = cmLoan.clientId;
        console.log(loan, cmLoan)

        const loanId = loan._id;
        delete loan._id;
        const resp = await db.collection('loans').updateOne({ _id: loanId }, { $set: { ...loan } });

        response = { success: true, response: resp };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}