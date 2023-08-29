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
    const currentDate = loan.currentDate;

    delete loan._id;
    delete loan.loanOfficer;
    delete loan.groupCashCollections;
    delete loan.loanReleaseStr;
    delete loan.allowApproved;
    delete loan.currentDate;
    delete loan.groupStatus;

    let groupData = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
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
                // await updateExistingLoan(loan.clientId);
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
                    { _id: new ObjectId(loanId) }, 
                    {
                        $set: { ...loan }
                    }, 
                    { upsert: false });

            loan._id = loanId;
            await saveCashCollection(loan, groupData, currentDate);
            
            response = { success: true, loan: loanResp };
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
            { _id: new ObjectId(groupId) }, 
            {
                $set: { ...group }
            }, 
            { upsert: false });
    
    return {success: true, groupResp}
}

async function updateClient(clientId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let client = await db.collection('client').find({ _id: new ObjectId(clientId) }).toArray();

    if (client.length > 0) {
        client = client[0];

        client.status = 'active';
        delete client._id;

        const clientResp = await db
            .collection('client')
            .updateOne(
                { _id: new ObjectId(clientId) }, 
                {
                    $set: { ...client }
                }, 
                { upsert: false });
    }
    
    return {success: true, client}
}

async function saveCashCollection(loan, group, currentDate) {
    const { db } = await connectToDatabase();

    const status = loan.status === "active" ? "tomorrow" : loan.status;

    let cashCollection = await db.collection('cashCollections').find({ clientId: loan.clientId, dateAdded: currentDate }).toArray();

    if (cashCollection.length > 0) {
        cashCollection = cashCollection[0];
        const ccId = cashCollection._id;
        delete cashCollection._id;

        await db.collection('cashCollections')
            .updateOne(
                { _id: ccId }, 
                {
                    $set: { ...cashCollection, status: status, loanCycle: loan.loanCycle, modifiedDate: currentDate }
                }, 
                { upsert: false }
            );
    } else {
        // this entry is only when the approve or reject is not the same day when it applies
        let data = {
            loanId: loan._id + '',
            branchId: loan.branchId,
            groupId: loan.groupId,
            groupName: loan.groupName,
            loId: loan.loId,
            clientId: loan.clientId,
            slotNo: loan.slotNo,
            loanCycle: loan.loanCycle,
            mispayment: false,
            mispaymentStr: 'No',
            collection: 0,
            excess: 0,
            total: 0,
            noOfPayments: 0,
            activeLoan: loan.activeLoan,
            targetCollection: loan.activeLoan,
            amountRelease: loan.amountRelease,
            loanBalance: loan.loanBalance,
            paymentCollection: 0,
            occurence: group.occurence,
            currentReleaseAmount: loan.amountRelease,
            fullPayment: 0,
            remarks: '',
            mcbu: loan.mcbu,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            status: status,
            dateAdded: currentDate,
            groupStatus: 'pending',
            origin: 'automation-ar-loan'
        };

        if (data.loanCycle === 1 && data.occurence === 'weekly') {
            data.mcbuCol = loan.mcbu;
        }

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = group.day;
        }

        await db.collection('cashCollections').insertOne({ ...data });
    }
}