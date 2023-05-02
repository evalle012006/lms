import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    post: transferClients
});

const currentDate = getCurrentDate();

async function transferClients(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const clients = req.body;
    let statusCode = 200;
    let response = {};

    if (clients.length > 0) {
        let group = await db.collection('groups').find({ _id: new ObjectId(clients[0].groupId) }).toArray();

        if (group.length > 0) {
            group = group[0];
            group.noOfClients = group.noOfClients ? group.noOfClients : 0;

            let groupFull = false;
            clients.map(async c => {
                let client = {...c};
                if (group.status === 'full') {
                    groupFull = true;
                } else {
                    let slotNo = client.slotNo;
                    if (slotNo !== '-') {
                        // if slot is not available assigned new slot
                        if (!group.availableSlots.includes(client.slotNo)) {
                            // get always the first available slot
                            slotNo = group.availableSlots[0];
                        }
                    }
            
                    let loan = client.loans.length > 0 ? client.loans[0] : null;
                    if (loan) {
                        loan.branchId = client.branchId;
                        loan.loId = client.loId;
                        loan.groupId = client.groupId;
                        loan.slotNo = slotNo;
                        
                        const loanId = loan._id;
                        delete loan._id;
                        await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: { ...loan } });
                        
                        group.availableSlots = group.availableSlots.filter(s => s !== loan.slotNo);
                        group.noOfClients = group.noOfClients + 1;
    
                        if (group.noOfClients === group.capacity) {
                            group.status = 'full';
                        }
                    }

                    await saveCashCollection(client, loan, group);
                    
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
                    if (client.slotNo === '-') {
                        delete updatedClient.slotNo;
                    }
                    delete updatedClient._id;
                    await db.collection('client').updateOne({ _id: new ObjectId(client._id) }, { $set: { ...updatedClient } });
                }
            });

            delete group._id;
            await db.collection('groups').updateOne(
                {  _id: new ObjectId(clients[0].groupId) },
                {
                    $set: { ...group }
                }, 
                { upsert: false }
            );
            
            if (groupFull) {
                response = { success: true, message: "Some client were not successfuly transfered due to selected group is full." };
            } else {
                response = { success: true };
            }
        } else {
            response = { error: true, message: "Group not found." };    
        }
    } else {
        response = { error: true, message: "No clients selected." };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveCashCollection(client, loan, group) {
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
            occurence: group.occurence,
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
            data.slotNo = loan.slotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.status = loan.status;
            data.mcbu = loan.mcbu;

            if (data.occurence === 'weekly') {
                data.mcbuTarget = 50;
                data.groupDay = group.groupDay;
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
            occurence: group.occurence,
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
            data.slotNo = loan.slotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.status = loan.status;
            data.mcbu = loan.mcbu;
        }

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = group.groupDay;
        }

        await db.collection('cashCollections').insertOne({ ...data });
    } else {
        await db.collection('cashCollections').updateOne({ _id: cashCollection[0]._id }, { $set: { transferred: client.sameLo ? false : true } })
    }
}