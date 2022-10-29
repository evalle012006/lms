import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    post: updateClient
});


async function updateClient(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const loan = req.body;

    let client = await db.collection('client').find({ _id: ObjectId(loan.clientId) }).toArray();

    if (client.length > 0) {
        client = client[0];

        client.status = 'offset';

        const clientResp = await db
            .collection('client')
            .updateOne(
                { _id: ObjectId(loan.clientId) }, 
                {
                    $set: { ...client }
                }, 
                { upsert: false });
        
        updateLoan(loan);
        updateGroup(loan);

        response = { success: true, client: clientResp };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateLoan(loanData) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: ObjectId(loanData.loanId) }).toArray();

    if (loan.length > 0) {
        loan = loan[0];

        loan.loanCycle = 0;
        loan.remarks = loanData.remarks;
        loan.status = 'closed';
        loan.dateModified = moment(new Date()).format('YYYY-MM-DD');
        delete loan._id;
        await db
            .collection('loans')
            .updateOne(
                { _id: ObjectId(loanData.loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
    }
}

async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let group = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();
    if (group.length > 0) {
        group = group[0];

        if (group.status === 'full') {
            group.status = 'available';
        }

        group.availableSlots.push(loan.slotNo);
        group.availableSlots.sort((a, b) => { return a - b; });
        group.noOfClients = group.noOfClients - 1;

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