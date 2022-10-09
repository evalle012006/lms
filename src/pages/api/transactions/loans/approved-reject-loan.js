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
                loan.slotNo = groupData.availableSlots.shift();
                groupData.noOfClients = noOfClients + 1;
    
                if (noOfClients === capacity) {
                    groupData.status = 'full';
                }
            } else {
                if (!groupData.availableSlots.includes(loan.slotNo)) {
                    groupData.availableSlots.push(loan.slotNo);
                    groupData.availableSlots.sort((a, b) => { return a - b; });
                    groupData.noOfClients = groupData.noOfClients - 1;
                }
            }
    
            const groupResp = await updateGroup(groupData);
            if (groupResp.success) {
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
        }
    } else {
        response = { error: true, message: 'Group data not found.' };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
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