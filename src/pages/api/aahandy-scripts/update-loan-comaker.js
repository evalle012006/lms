import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getWeekDaysCount } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    post: updateLoanData
});

async function updateLoanData(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let statusCode = 200;
    let response = {};

    const loans = await db.collection('loans').find({}).toArray();
    loans.map(async loan => {
        let temp = {...loan};

        if (temp.coMaker && typeof temp.coMaker === 'string') {
            console.log('COMAKER: ', temp.coMaker)
            let client = await db.collection('client').find({_id: new ObjectId(loan.coMaker)}).toArray();
            if (client && client.length > 0) {
                const coMakerLoan = await db.collection('loans').find({clientId: loan.coMaker, status: 'active'}).toArray();
                if (coMakerLoan && coMakerLoan.length > 0) {
                    temp.coMaker = coMakerLoan[0].slotNo;
                }

                temp.coMakerId = client[0]._id + '';
                await updateLoan(temp);
            }
        }
    });

    response = { success: true, loans: loans };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateLoan(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const loanId = loan._id;
    delete loan._id;

    const loanResp = await db
        .collection('loans')
        .updateOne(
            { _id: new ObjectId(loanId) }, 
            {
                $set: { ...loan }
            }, 
            { upsert: false });

    return loanResp;
}
