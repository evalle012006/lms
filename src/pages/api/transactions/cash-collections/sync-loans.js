import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: syncLoans
});

async function syncLoans(req, res) {
    const { db } = await connectToDatabase();

    const { loId } = req.body;

    await tomorrowLoans(loId);

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function tomorrowLoans(loId) {
    const { db } = await connectToDatabase();
    
    const loans = await db.collection('loans').find({ status: "tomorrow", loId: loId }).toArray();

    loans.map(async (loan) => {
        let temp = {...loan};
        const loanTerms = loan.loanTerms;

        temp.activeLoan = (loan.principalLoan * 1.20) / loanTerms;
        temp.loanBalance = loan.principalLoan * 1.20;
        temp.amountRelease = temp.loanBalance;
        temp.status = 'active';
        temp.remediated = moment(new Date()).format('YYYY-MM-DD') + ' - ' + 'WRONG_STATUS';
        
        delete temp._id;
        
        await db.collection('loans').updateOne({ _id: loan._id }, {$set: {...temp}});
    });
}