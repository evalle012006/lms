import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    post: approveReject,
});

let statusCode = 200;
let response;

async function approveReject(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const transfers = req.body;

    const errorMsg = new Set();
    const promise = await new Promise(async (resolve) => {
        const promiseResponse = await Promise.all(transfers.map(async (transfer) => {
            if (transfer.status === "approved") {
                let client = {...transfer.client};

                let sourceGroup = transfer.sourceGroup;
                let targetGroup = transfer.targetGroup;
    
                const sourceGroupId = sourceGroup._id;
                const targetGroupId = targetGroup._id;
                delete sourceGroup._id;
                delete targetGroup._id;
    
                const existingCashCollection = await db.collection('cashCollections').find({ clientId: client._id, groupId: transfer.oldGroupId, dateAdded: transfer.dateAdded }).toArray();
    
                targetGroup.noOfClients = targetGroup.noOfClients ? targetGroup.noOfClients : 0;
                if (targetGroup.status === 'full') {
                    errorMsg.add("Some client were not successfuly transfered due to selected group is full.");
                } else {
                    let selectedSlotNo = transfer.selectedSlotNo;
                    const clientLoans = await db.collection('loans').find({ clientId: transfer.selectedClientId, status: { $in: ['active', 'completed', 'pending'] } }).toArray();
                    const validateLoan = getAndValidateLoan(clientLoans);
                    const loan = validateLoan.loan;

                    if (validateLoan.error) {
                        errorMsg.add(validateLoan.errorMsg);
                    } else {
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
                                delete loan.transferId;
                                delete loan.transferDate;
                                delete loan.transfer;
                                delete loan.transferredDate;
                                delete loan.transferred;

                                let updatedLoan = {...loan};
                                updatedLoan.branchId = transfer.targetBranchId;
                                updatedLoan.loId = transfer.targetUserId;
                                updatedLoan.groupId = transfer.targetGroupId;
                                updatedLoan.groupName = targetGroup.name;
                                updatedLoan.slotNo = selectedSlotNo;
                                updatedLoan.mcbuCollection = loan.mcbu;
                                updatedLoan.transferId = transfer._id;
                                updatedLoan.transfer = true;
                                if (updatedLoan.status == 'active') {
                                    updatedLoan.startDate = moment(transfer.dateAdded).add(1, 'days').format("YYYY-MM-DD");
                                }
                                updatedLoan.transferDate = transfer.dateAdded;
                                updatedLoan.insertedDateTime = new Date();
        
                                if (updatedLoan.status == 'completed' && updatedLoan.fullPaymentDate == transfer.dateAdded) {
                                    updatedLoan.fullPaymentDate = null;
                                }
        
                                if (existingCashCollection.length > 0) {
                                    const prevLoanId = existingCashCollection[0].prevLoanId;
                                    let prevLoan = await db.collection('loans').find({ _id: new ObjectId(prevLoanId) }).toArray();
                                    if (prevLoan.length > 0) {
                                        prevLoan = prevLoan[0];
        
                                        if (existingCashCollection[0].status == 'tomorrow' || existingCashCollection[0].status == 'pending') {
                                            prevLoan.transferredReleased = true;
                                        }
        
                                        if (existingCashCollection[0].status == 'completed') {
                                            updatedLoan.status = 'completed';
                                        }
                                    }
                                    delete prevLoan._id;
                                    await db.collection('loans').updateOne({ _id: new ObjectId(prevLoanId) }, {$set: {...prevLoan}});
                                }
        
                                const newLoan = await db.collection('loans').insertOne({ ...updatedLoan });
                                if (newLoan.acknowledged) {
                                    loan.status = "closed"
                                    loan.transferred = true;
                                    loan.transferId = transfer._id;
                                    loan.transferredDate = transfer.dateAdded;
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
        
                        await saveCashCollection(transfer, client, loan, sourceGroup, targetGroup, selectedSlotNo, existingCashCollection);
        
                        const updatedClient = {...client};
                        delete updatedClient._id;
                        
                        await db.collection('client').updateOne({ _id: new ObjectId(client._id) }, { $set: { ...updatedClient } });
                        await db.collection('transferClients').updateOne(
                            {_id: new ObjectId(transfer._id)}, 
                            { $set: {
                                loanId: loan?._id,
                                status: "approved", 
                                occurence: sourceGroup.occurence, 
                                approveRejectDate: transfer.dateAdded,
                                modifiedDateTime: new Date()
                            } }
                        );
                    }

                    response = { success: true };
                }
            } else {
                await db.collection('transferClients').updateOne({_id: new ObjectId(transfer._id)}, { $set: {status: "reject", modifiedDateTime: new Date()} });
            }
        }));

        resolve(promiseResponse);
    });

    if (promise) {
        const errors = Array.from(errorMsg);
        console.log(errors)
        if (errors.length > 0) {
            response = { success: true, message: errors.join('<br/>')};
        } else {
            response = { success: true }
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveCashCollection(transfer, client, loan, sourceGroup, targetGroup, selectedSlotNo, existingCashCollection) {
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
            remarks: null,
            dateAdded: transfer.dateAdded,
            groupStatus: 'closed',
            transferId: transfer._id,
            transferDate: transfer.dateAdded,
            sameLo: transfer.sameLo, 
            transfer: true,
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
            data.slotNo = selectedSlotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.mcbu = loan.mcbu;
            data.pastDue = loan.pastDue;
            data.noPastDue = loan.noPastDue;
            data.loanTerms = loan.loanTerms;
            data.remarks = existingCashCollection.length > 0 ? existingCashCollection[0].remarks : null;
            data.status = existingCashCollection.length > 0 ? existingCashCollection[0].status : null;

            if (data.status == 'tomorrow')  {
                data.amountRelease = 0;
                data.loanBalance = 0;
                data.targetCollection = 0;
                data.activeLoan = 0;
            }

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
                transfer: true,
                sameLo: transfer.sameLo, 
                transferId: transfer._id, 
                transferDate: transfer.dateAdded,
                loToLo: transfer.loToLo, 
                branchToBranch: transfer.branchToBranch,
                modifiedDateTime: new Date()
            } }
        )
    }

    // add or update client data on cash collection
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
            transferredDate: transfer.dateAdded,
            sameLo: transfer.sameLo, 
            transferred: true,
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
            data.remarks = loan?.history?.remarks;
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
                transferred: true,
                sameLo: transfer.sameLo, 
                transferId: transfer._id, 
                transferredDate: transfer.dateAdded,
                loToLo: transfer.loToLo, 
                branchToBranch: transfer.branchToBranch,
                modifiedDateTime: new Date()
            } }
        )
    }
}

function getAndValidateLoan(loans) {
    let withError = false;
    let errorMsg;
    let loan;

    if (loans.length > 0) {
        if (loans.length > 1) {
            withError = true;
            errorMsg = `Slot No ${loans[0].slotNo} from group ${loans[0].groupName} has multiple loans open. Please contact System support.`;
        } else {
            loan = loans[0];
        }
    } else {
        withError = true;
        errorMsg = `Client has no active loans.`;
    }

    return { loan: loan, error: withError, errorMsg: errorMsg };
}