import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    post: saveUpdate,
    get: getList
});

let statusCode = 200;
let response = {};

const currentDate = getCurrentDate();

async function saveUpdate(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const clientData = req.body;

    let sourceGroup = await db.collection('groups').find({ _id: new ObjectId(clientData.oldGroupId) }).toArray();
    sourceGroup = sourceGroup.length > 0 ? sourceGroup[0] : [];
    delete sourceGroup._id;

    let targetGroup = await db.collection('groups').find({ _id: new ObjectId(clientData.groupId) }).toArray();
    if (targetGroup.length > 0) {
        targetGroup = targetGroup[0];
        delete targetGroup._id;
        targetGroup.noOfClients = targetGroup.noOfClients ? targetGroup.noOfClients : 0;

        let client = {...clientData};
        let loan = client.loans.length > 0 ? client.loans[0] : null;
        if (targetGroup.status === 'full') {
            response = { success: true, message: "Some client were not successfuly transfered due to selected group is full." };
        } else {
            if (client.slotNo !== '-') {
                let slotNo = client.slotNo;
                // if slot is not available assigned new slot   slotNo = 1
                if (!targetGroup.availableSlots.includes(slotNo)) { // [6,7,8,9,10]
                    // get always the first available slot
                    slotNo = targetGroup.availableSlots[0];
                }

                targetGroup.availableSlots = targetGroup.availableSlots.filter(s => s !== slotNo);
                targetGroup.noOfClients = targetGroup.noOfClients + 1;

                if (targetGroup.noOfClients === targetGroup.capacity) {
                    targetGroup.status = 'full';
                }

                // put back the slotNo in the source group
                sourceGroup.availableSlots.push(client.slotNo);
                sourceGroup.availableSlots.sort((a, b) => { return a - b; });
                sourceGroup.noOfClients = sourceGroup.noOfClients - 1;

                await db.collection('groups').updateOne( {  _id: new ObjectId(client.oldGroupId) }, { $set: { ...sourceGroup } }, { upsert: false } );
                await db.collection('groups').updateOne( {  _id: new ObjectId(client.groupId) }, { $set: { ...targetGroup } }, { upsert: false } );

                if (loan) {
                    loan.branchId = client.branchId;
                    loan.loId = client.loId;
                    loan.groupId = client.groupId;
                    loan.groupName = client.groupName;
                    loan.slotNo = slotNo;
                    
                    const loanId = loan._id;
                    delete loan._id;
                    await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: { ...loan } });
                    loan._id = loanId;
                }
            }

            await saveCashCollection(client, loan, sourceGroup, targetGroup);
            
            const updatedClient = {...client};
            delete updatedClient.oldGroupId;
            delete updatedClient.oldBranchId;
            delete updatedClient.oldLoId;
            delete updatedClient.selected;
            delete updatedClient.loans;
            delete updatedClient.loanStatus;
            delete updatedClient.activeLoanStr;
            delete updatedClient.loanBalanceStr;
            delete updatedClient.label;
            delete updatedClient.value;
            delete updatedClient.sameLo;
            delete updatedClient.clientIdStr;
            delete updatedClient.slotNo;
            delete updatedClient._id;
            await db.collection('client').updateOne({ _id: new ObjectId(client._id) }, { $set: { ...updatedClient } });

            response = { success: true };
        }
    } else {
        response = { error: true, message: "Group not found." };    
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveCashCollection(client, loan, sourceGroup, targetGroup) {
    const { db } = await connectToDatabase();

    // add new cash collection entry with updated data
    const cashCollection = await db.collection('cashCollections').find({ clientId: client._id, groupId: client.groupId, dateAdded: moment(currentDate).format('YYYY-MM-DD') }).toArray();    
    if (cashCollection.length === 0) {
        let data = {
            branchId: client.branchId,
            groupId: client.groupId,
            loId: client.loId,
            clientId: client._id,
            mispayment: false,
            mispaymentStr: 'No',
            collection: 0,
            excess: 0,
            total: 0,
            activeLoan: 0,
            targetCollection: 0,
            amountRelease: 0,
            loanBalance: 0,
            paymentCollection: 0,
            occurence: targetGroup.occurence,
            currentReleaseAmount: 0,
            fullPayment: 0,
            mcbu: 0,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            remarks: '',
            dateAdded: moment(currentDate).format('YYYY-MM-DD'),
            groupStatus: 'pending',
            transfer: client.sameLo ? false : true,
            origin: 'automation-trf'
        };

        if (loan) {
            data.loanId = loan._id;
            data.activeLoan = loan.activeLoan;
            data.targetCollection = loan.activeLoan;
            data.amountRelease = loan.amountRelease;
            data.loanBalance = loan.loanBalance;
            data.slotNo = loan.slotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.status = loan.status;
            data.mcbu = loan.mcbu;

            if (data.occurence === 'weekly') {
                data.mcbuTarget = 50;
                data.groupDay = targetGroup.groupDay;
            }
        }

        await db.collection('cashCollections').insertOne({ ...data });
    } else {
        await db.collection('cashCollections').updateOne({ _id: cashCollection[0]._id }, { $set: { transfer: client.sameLo ? false : true } })
    }

    // add or update client data on cash collection
    const existingCashCollection = await db.collection('cashCollections').find({ clientId: client._id, groupId: client.oldGroupId, dateAdded: moment(currentDate).format('YYYY-MM-DD') }).toArray();
    if (existingCashCollection.length === 0) {
        let data = {
            branchId: client.oldBranchId,
            groupId: client.oldGroupId,
            loId: client.oldLoId,
            clientId: client._id,
            mispayment: false,
            mispaymentStr: 'No',
            collection: 0,
            excess: 0,
            total: 0,
            activeLoan: 0,
            targetCollection: 0,
            amountRelease: 0,
            loanBalance: 0,
            paymentCollection: 0,
            occurence: sourceGroup.occurence,
            currentReleaseAmount: 0,
            fullPayment: 0,
            mcbu: 0,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            remarks: '',
            dateAdded: moment(currentDate).format('YYYY-MM-DD'),
            groupStatus: 'pending',
            transferred: client.sameLo ? false : true,
            origin: 'automation-trf'
        };

        if (loan) {
            data.loanId = loan._id;
            data.activeLoan = loan.activeLoan;
            data.targetCollection = loan.activeLoan;
            data.amountRelease = loan.amountRelease;
            data.loanBalance = loan.loanBalance;
            data.slotNo = loan.slotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.status = loan.status;
            data.mcbu = loan.mcbu;
        }

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = sourceGroup.groupDay;
        }

        await db.collection('cashCollections').insertOne({ ...data });
    } else {
        await db.collection('cashCollections').updateOne({ _id: existingCashCollection[0]._id }, { $set: { transferred: client.sameLo ? false : true } })
    }
}