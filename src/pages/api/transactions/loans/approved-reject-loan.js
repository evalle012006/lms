import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateLoan
});

async function updateLoan(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    let loan = req.body;
    const loanId = loan._id;
    delete loan._id;

    const groupCashCollections = await db
        .collection('groupCashCollections')
        .find({ groupId: loan.groupId, dateAdded: loan.dateGranted})
        .toArray();

    if (groupCashCollections.length > 0 && groupCashCollections[0].status === 'close') {
        response = { error: true, message: "Loan can't be approved because the Group Transaction is already closed!" };
    } else {
        let groupData = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();
        if (groupData.length > 0) {
            groupData = groupData[0];
            let status = groupData.status;
            let noOfClients = groupData.noOfClients;
            const capacity = groupData.capacity;

            if (status === 'full' || noOfClients >= capacity) {
                response = {
                    error: true,
                    message: `"${groupData.name}" is already full. Please select another group.`
                };
            } else {
                if (loan.status === 'active') {
                    await updateClient(loan.clientId);
                    await updateExistingLoan(loan.clientId);
                }  else if (loan.status === 'reject') {
                    if (!groupData.availableSlots.includes(loan.slotNo)) {
                        groupData.availableSlots.push(loan.slotNo);
                        groupData.availableSlots.sort((a, b) => { return a - b; });
                        groupData.noOfClients = groupData.noOfClients - 1;
                        groupData.status = groupData.status === 'full' ? 'available' : groupData.status;
                        await updateGroup(groupData);
                    }
                }
            
                const loanResp = await db
                    .collection('loans')
                    .updateOne(
                        { _id: ObjectId(loanId) }, 
                        {
                            $set: { ...loan }
                        }, 
                        { upsert: false });
                
                response = { success: true, loan: loanResp };
            }
        } else {
            response = { error: true, message: 'Group data not found.' };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateExistingLoan(clientId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;

    let activeLoan  = await db
        .collection('loans')
        .find({ clientId: clientId, status: 'active' })
        .toArray();

    if (activeLoan.length > 0) {
        response = { error: true, message: 'Client has still existing active loan.' };
    } else {
        let existingLoan = await db
            .collection('loans')
            .find({ clientId: clientId, status: 'completed' })
            .toArray();
        
        if (existingLoan.length > 0) {
            existingLoan = existingLoan[0];
            const loanId = existingLoan._id;
            delete existingLoan._id;
            existingLoan.status = 'closed';
            const loanResp = await db
                .collection('loans')
                .updateOne(
                    { _id: ObjectId(loanId) },
                    {
                        $set: {...existingLoan}
                    },
                    { upsert: false }
                );
            response = {success: true};
        }
    }

    return response;
}

async function updateGroup(group) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const groupId = group._id;
    delete group._id;

    const groupResp = await db
        .collection('groups')
        .updateOne(
            { _id: ObjectId(groupId) }, 
            {
                $set: { ...group }
            }, 
            { upsert: false });
    
    return {success: true, groupResp}
}

async function updateClient(clientId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let client = await db.collection('client').find({ _id: ObjectId(clientId) }).toArray();

    if (client.length > 0) {
        client = client[0];

        client.status = 'active';
        delete client._id;

        const clientResp = await db
            .collection('client')
            .updateOne(
                { _id: ObjectId(clientId) }, 
                {
                    $set: { ...client }
                }, 
                { upsert: false });
    }
    
    return {success: true, client}
}