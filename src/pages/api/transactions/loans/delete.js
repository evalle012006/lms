import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteLoan
});

async function deleteLoan(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const loanData = req.body;

    let statusCode = 200;
    let response = {};

    const loans = await db
        .collection('loans')
        .find({ _id: ObjectId(loanData._id) })
        .toArray();

    if (loans.length > 0) {
        // delete loanData._id;
        await db
            .collection('loans')
            // .updateOne(
            //     {  _id: ObjectId(loans[0]._id) },
            //     {
            //         $set: { ...loanData }
            //     }, 
            //     { upsert: false }
            // );
            .deleteOne({ _id: ObjectId(loanData._id) });
        
        updateGroup(loans[0]);

        response = {
            success: true
        }
    } else {
        response = {
            error: true,
            message: `Loan with id: "${_id}" not exists`
        };
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

        if (!group.availableSlots.includes(loan.slotNo)) {
            group.availableSlots.push(loan.slotNo);
            group.availableSlots.sort((a, b) => { return a - b; });
            group.noOfClients = group.noOfClients - 1;
            group.status = group.status === 'full' ? 'available' : group.status;
        }

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