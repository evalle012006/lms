import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const loanData = req.body;

    const { db } = await connectToDatabase();

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

        updateGroup(loanData);

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