import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const loanData = req.body;

    const { db } = await connectToDatabase();

    let mode;
    let oldLoanId;
    
    if (loanData.hasOwnProperty('mode')) {
        mode = loanData.mode;
        oldLoanId = loanData.oldLoanId;
        delete loanData.mode;
        delete loanData.oldLoanId;
    }

    const loans = await db
        .collection('loans')
        .find({ clientId: loanData.clientId, status: 'active' })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (loans.length > 0) {
        response = {
            error: true,
            fields: ['clientId'],
            message: `Client "${loanData.fullName}" already have an active loan`
        };
    } else {
        const loan = await db.collection('loans').insertOne({
            ...loanData,
            dateGranted: moment(new Date()).format('YYYY-MM-DD')
        });

        if (mode === 'reloan') {
            updateLoan(oldLoanId);
        } else {
            updateGroup(loanData);
        }

        response = {
            success: true,
            loan: loan
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let group = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();
    if (group.length > 0) {
        group = group[0];

        group.availableSlots = group.availableSlots.filter(s => s !== loan.slotNo);
        group.noOfClients = group.noOfClients + 1;

        if (group.noOfClients === group.capacity) {
            group.status = 'full';
        }

        delete group._id;
        await db.collection('groups').updateOne(
            {  _id: ObjectId(loan.groupId) },
            {
                $set: { ...group }
            }, 
            { upsert: false }
        );
    }
}

async function updateLoan(loanId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: ObjectId(loanId) }).toArray();

    if (loan.length > 0) {
        loan = loan[0];

        loan.status = 'closed';

        await db
            .collection('loans')
            .updateOne(
                { _id: ObjectId(loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
    }
}