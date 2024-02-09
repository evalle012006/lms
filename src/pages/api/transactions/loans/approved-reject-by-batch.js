import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: processData
});

async function processData(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};
    let errorMsg = [];

    let loanData = req.body;

    const origin = (loanData && loanData.length > 0) && loanData[0].origin;

    if (origin == 'ldf') {
        loanData.map(async loan => {
            const loanId = loan._id;
    
            delete loan._id;
            delete loan.loanOfficer;
            delete loan.groupCashCollections;
            delete loan.loanReleaseStr;
            delete loan.allowApproved;
            delete loan.currentDate;
            delete loan.groupStatus;

            await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $set: {...loan} });
        });
    } else {
        loanData.map(async loan => {
            const loanId = loan._id;
            const currentDate = loan.currentDate;
    
            delete loan._id;
            delete loan.loanOfficer;
            delete loan.groupCashCollections;
            delete loan.loanReleaseStr;
            delete loan.allowApproved;
            delete loan.currentDate;
            delete loan.groupStatus;
    
            let groupData = await checkGroupStatus(loan.groupId);
            if (groupData.length > 0) {
                groupData = groupData[0];
    
                if (loan.status === 'active') {
                    await updateClient(loan);
                    if (loan.coMaker) {
                        if (typeof loan.coMaker === 'string') {
                            loan.coMakerId = loan.coMaker;
                            const coMakerResp = await getCoMakerInfo(loan.coMaker, loan.groupId);
                            if (coMakerResp.success) {
                                loan.coMaker = coMakerResp.client;
                            }
                        } else if (typeof loan.coMaker === 'number') {
                            const coMakerResp = await getCoMakerInfo(loan.coMaker, loan.groupId);
                            if (coMakerResp.success) {
                                loan.coMakerId = coMakerResp.client;
                            }
                        }
                    }
                }  else if (loan.status === 'reject') {
                    if (!groupData.availableSlots.includes(loan.slotNo)) {
                        groupData.availableSlots.push(loan.slotNo);
                        groupData.availableSlots.sort((a, b) => { return a - b; });
                        groupData.noOfClients = groupData.noOfClients - 1;
                        groupData.status = groupData.status === 'full' ? 'available' : groupData.status;
                        await updateGroup(groupData);
                    }
                }
    
                if (loan.status === 'active' || loan.status === 'reject') {
                    await db.collection('loans')
                        .updateOne(
                            { _id: new ObjectId(loanId) }, 
                            {
                                $set: { ...loan }
                            }, 
                            { upsert: false });
                    
                    loan._id = loanId;
                    await saveCashCollection(loan, groupData, currentDate);
                }
            }
        });
    }

    response = { success: true, error: errorMsg };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function checkGroupStatus(groupId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const groupData = await db.collection('groups').find({ _id: new ObjectId(groupId) }).toArray();

    return groupData;
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

async function updateClient(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const clientId = loan.clientId;
    let client = await db.collection('client').find({ _id: new ObjectId(clientId) }).toArray();

    if (client.length > 0) {
        client = client[0];
        
        if (client.status == 'offset') {
            client.status = 'active';
            client.groupName = loan?.groupName;
            client.groupId = loan.groupId;
            client.branchId = loan.branchId;
            client.loId = loan.loId;
            client.oldGroupId = null;
            client.oldLoId =  null;
        }

        client.status = 'active';
        delete client._id;

        await db
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

async function getCoMakerInfo(coMaker, groupId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let client;
    if (typeof coMaker === 'number') {
        const loan = await db.collection('loans').aggregate([ 
            { $match: {
                $expr: { $and: [
                    { $eq: ['$groupId', groupId] },
                    { $or: [
                        {$eq: ['$status', 'active']},
                        {$eq: ['$status', 'pending']}
                    ] },
                    { $eq: ['$slotNo', coMaker] }
                ] }
            } } 
        ]).toArray();

        if (loan && loan.length > 0) {
            client = loan[0].clientId;
        }
    } else if (typeof coMaker === 'string') {
        const loan = await db.collection('loans').aggregate([ 
            { $match: {
                $expr: { $and: [
                    { $eq: ['$clientId', coMaker] },
                    { $or: [
                        {$eq: ['$status', 'active']},
                        {$eq: ['$status', 'pending']}
                    ] }
                ] }
            } } 
        ]).toArray();

        if (loan && loan.length > 0) {
            client = loan[0].slotNo;
        }
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
            groupStatus: 'closed',
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