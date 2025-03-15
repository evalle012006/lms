import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: processData
});

async function processData(req, res) {
    const { db } = await connectToDatabase();
    const loanData = req.body;

    let response = {};
    let statusCode = 200;
    let errorMsg = [];

    loanData.map(data => {
        const loans = checkExistingLoan(data);

        if (loans.length > 0) {
            errorMsg.push({
                error: true,
                fields: ['clientId'],
                message: `Client "${loanData.fullName}" already have an active loan`
            });
        } else {
            save(data);
            updateGroup(data);
        }

        response = {
            success: true,
            error: errorMsg
        }
    });

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function checkExistingLoan(loan) {
    const { db } = await connectToDatabase();

    const loans = await db
            .collection('loans')
            .find({ clientId: loan.clientId, status: 'active' })
            .toArray();

    return loans;
}

async function save(loan) {
    const { db } = await connectToDatabase();
    
    await db.collection('loans').insertOne({
        ...loan,
        dateGranted: moment(getCurrentDate()).format('YYYY-MM-DD')
    });
}


async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
    if (group.length > 0) {
        group = group[0];

        group.availableSlots = group.availableSlots.filter(s => s !== loan.slotNo);
        group.noOfClients = group.noOfClients + 1;

        if (group.noOfClients === group.capacity) {
            group.status = 'full';
        }

        delete group._id;
        await db.collection('groups').updateOne(
            {  _id: new ObjectId(loan.groupId) },
            {
                $set: { ...group }
            }, 
            { upsert: false }
        );
    }
}