import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    post: approveReject,
});

let statusCode = 200;
let response = {};

async function approveReject(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const transfers = req.body;

    let groupFullError = false;
    transfers.map(async (transfer) => {
        if (transfer.status === "approved") {
            // let sourceGroup = await db.collection('groups').find({ _id: new ObjectId(transfer.oldGroupId) }).toArray();
            // let targetGroup = await db.collection('groups').find({ _id: new ObjectId(transfer.groupId) }).toArray();
    
            let client = {...transfer.client};
            let loan = transfer.loans.length > 0 ? transfer.loans[0] : null;
            let sourceGroup = transfer.sourceGroup;
            let targetGroup = transfer.targetGroup;

            const sourceGroupId = sourceGroup._id;
            const targetGroupId = targetGroup._id;
            delete sourceGroup._id;
            delete targetGroup._id;

            targetGroup.noOfClients = targetGroup.noOfClients ? targetGroup.noOfClients : 0;
            if (targetGroup.status === 'full') {
                groupFullError = true;
            } else {
                let selectedSlotNo = transfer.selectedSlotNo;
                if (selectedSlotNo !== '-') {
                    // if slot is not available assigned new slot   slotNo = 1
                    if (!targetGroup.availableSlots.includes(selectedSlotNo)) { // [6,7,8,9,10]
                        // get always the first available slot
                        selectedSlotNo = targetGroup.availableSlots[0];
                    }

                    targetGroup.availableSlots = targetGroup.availableSlots.filter(s => s !== selectedSlotNo);
                    targetGroup.noOfClients = targetGroup.noOfClients + 1;
    
                    if (targetGroup.noOfClients === targetGroup.capacity) {
                        targetGroup.status = 'full';
                    }
    
                    // put back the slotNo in the source group
                    if (!sourceGroup.availableSlots.includes(transfer.currentSlotNo)) {
                        sourceGroup.availableSlots.push(transfer.currentSlotNo);
                        sourceGroup.availableSlots.sort((a, b) => { return a - b; });   
                    }
                    sourceGroup.noOfClients = sourceGroup.noOfClients - 1;
    
                    await db.collection('groups').updateOne( {  _id: new ObjectId(sourceGroupId) }, { $set: { ...sourceGroup } }, { upsert: false } );
                    await db.collection('groups').updateOne( {  _id: new ObjectId(targetGroupId) }, { $set: { ...targetGroup } }, { upsert: false } );
    
                    if (loan) {
                        const loanId = loan._id;
                        delete loan._id;
                        let updatedLoan = {...loan};
                        updatedLoan.branchId = transfer.targetBranchId;
                        updatedLoan.loId = transfer.targetUserId;
                        updatedLoan.groupId = transfer.targetGroupId;
                        updatedLoan.slotNo = selectedSlotNo;
                        updatedLoan.startDate = moment(transfer.dateAdded).add(1, 'days').format("YYYY-MM-DD");
                        updatedLoan.insertedDateTime = new Date();
                        const newLoan = await db.collection('loans').insertOne({ ...updatedLoan });
                        if (newLoan.acknowledged) {
                            loan.status = "closed"
                            loan.transferred = true;
                            loan.endDate = transfer.dateAdded;
                            loan.modifiedDateTime = new Date();
                            await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: { ...loan } });
                            loan._id = newLoan.insertedId + "";
                            loan.oldId = loanId;
                        }
                    }
                }                
                
                client.branchId = transfer.targetBranchId;
                client.loId = transfer.targetUserId;
                client.groupId = transfer.targetGroupId;
                client.groupName = targetGroup.name;

                await saveCashCollection(transfer, client, loan, sourceGroup, targetGroup);

                const updatedClient = {...client};
                delete updatedClient._id;
                
                await db.collection('client').updateOne({ _id: new ObjectId(client._id) }, { $set: { ...updatedClient } });
                await db.collection('transferClients').updateOne(
                    {_id: new ObjectId(transfer._id)}, 
                    { $set: {
                        status: "approved", 
                        occurence: sourceGroup.occurence, 
                        approveRejectDate: transfer.dateAdded,
                        modifiedDateTime: new Date()
                    } }
                );
    
                response = { success: true };
            }
        } else {
            await db.collection('transferClients').updateOne({_id: new ObjectId(transfer._id)}, { $set: {status: "rejected", modifiedDateTime: new Date()} });
        }
    });

    if (groupFullError) {
        response = { success: true, message: "Some client were not successfuly transfered due to selected group is full." };
    } else {
        response = { success: true }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveCashCollection(transfer, client, loan, sourceGroup, targetGroup) {
    const { db } = await connectToDatabase();

    // add new cash collection entry with updated data
    const cashCollection = await db.collection('cashCollections').find({ clientId: client._id, groupId: client.groupId, dateAdded: transfer.dateAdded }).toArray();    
    if (cashCollection.length === 0) {
        let data = {
            branchId: transfer.targetBranchId,
            groupId: transfer.targetGroupId,
            loId: transfer.targetUserId,
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
            dateAdded: transfer.dateAdded,
            groupStatus: 'closed',
            transferId: transfer._id,
            sameLo: transfer.sameLo, 
            transfer: transfer.sameLo ? false : true,
            loToLo: transfer.loToLo,
            branchToBranch: transfer.branchToBranch,
            insertedDateTime: new Date(),
            origin: 'automation-trf'
        };

        if (loan) {
            data.oldLoanId = loan.oldId;
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
            data.pastDue = loan.pastDue;
            data.noPastDue = loan.noPastDue;
            data.loanTerms = loan.loanTerms;

            if (data.occurence === 'weekly') {
                // data.mcbuTarget = 50;
                data.groupDay = targetGroup.groupDay;
            }
        }

        await db.collection('cashCollections').insertOne({ ...data });
    } else {
        await db.collection('cashCollections').updateOne(
            { _id: cashCollection[0]._id }, 
            { $set: { 
                transfer: transfer.sameLo ? false : true,
                sameLo: transfer.sameLo, 
                transferId: transfer._id, 
                loToLo: transfer.loToLo, 
                branchToBranch: transfer.branchToBranch,
                modifiedDateTime: new Date()
            } }
        )
    }

    // add or update client data on cash collection
    const existingCashCollection = await db.collection('cashCollections').find({ clientId: client._id, groupId: transfer.oldGroupId, dateAdded: transfer.dateAdded }).toArray();
    if (existingCashCollection.length === 0) {
        let data = {
            branchId: transfer.oldBranchId,
            groupId: transfer.oldGroupId,
            loId: transfer.oldLoId,
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
            dateAdded: transfer.dateAdded,
            groupStatus: 'closed',
            transferId: transfer._id,
            sameLo: transfer.sameLo, 
            transferred: transfer.sameLo ? false : true,
            loToLo: transfer.loToLo,
            branchToBranch: transfer.branchToBranch,
            insertedDateTime: new Date(),
            origin: 'automation-trf'
        };

        if (loan) {
            data.loanId = loan.oldId;
            data.activeLoan = loan.activeLoan;
            data.targetCollection = loan.activeLoan;
            data.amountRelease = loan.amountRelease;
            data.loanBalance = loan.loanBalance;
            data.slotNo = loan.slotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.status = loan.status;
            data.mcbu = loan.mcbu;
            data.loanTerms = loan.loanTerms;
        }

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = sourceGroup.groupDay;
        }

        await db.collection('cashCollections').insertOne({ ...data });
    } else {
        await db.collection('cashCollections').updateOne(
            { _id: existingCashCollection[0]._id }, 
            { $set: { 
                transferred: transfer.sameLo ? false : true,
                sameLo: transfer.sameLo, 
                transferId: transfer._id, 
                loToLo: transfer.loToLo, 
                branchToBranch: transfer.branchToBranch,
                modifiedDateTime: new Date()
            } }
        )
    }
}