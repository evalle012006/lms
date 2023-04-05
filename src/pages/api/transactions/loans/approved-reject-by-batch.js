import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

export default apiHandler({
    post: processData
});

async function processData(req, res) {
    let statusCode = 200;
    let response = {};
    let errorMsg = [];

    let loanData = req.body;

    loanData.map(async loan => {
        const loanId = loan._id;
        delete loan._id;
        delete loan.loanOfficer;
        delete loan.groupCashCollections;
        
        let groupData = await checkGroupStatus(loan.groupId);
        if (groupData.length > 0) {
            groupData = groupData[0];
            let status = groupData.status;
            let noOfClients = groupData.noOfClients;
            const capacity = groupData.capacity;

            if (status === 'full' || noOfClients >= capacity) {
                errorMsg.push({
                    error: true,
                    message: `"${groupData.name}" is already full. Please select another group.`
                });
            } else {
                if (loan.status === 'active') {
                    await updateClient(loan.clientId);
                    await updateExistingLoan(loan, loanId);
                }  else if (loan.status === 'reject') {
                    if (!groupData.availableSlots.includes(loan.slotNo)) {
                        groupData.availableSlots.push(loan.slotNo);
                        groupData.availableSlots.sort((a, b) => { return a - b; });
                        groupData.noOfClients = groupData.noOfClients - 1;
                        groupData.status = groupData.status === 'full' ? 'available' : groupData.status;
                        await updateGroup(groupData);
                    }
                }
                
                // await updateLoan(loanId, loan);
                await saveCashCollection(loan);
            }
        }
    });

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

async function updateLoan(loanId, loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    await db.collection('loans')
            .updateOne(
                { _id: new ObjectId(loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
}

async function updateExistingLoan(loan, lId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;

    let activeLoan  = await db
        .collection('loans')
        .find({ clientId: loan.clientId, status: 'active' })
        .toArray();

    if (activeLoan.length > 0) {
        response = { error: true, message: 'Client has still existing active loan.' };
    } else {
        let existingLoan = await db
            .collection('loans')
            .find({ clientId: loan.clientId, status: 'completed' })
            .toArray();
        
        if (existingLoan.length > 0) {
            existingLoan = existingLoan[0];
            const loanId = existingLoan._id;
            delete existingLoan._id;
            existingLoan.status = 'closed';
            await db
                .collection('loans')
                .updateOne(
                    { _id: new ObjectId(loanId) },
                    {
                        $set: {...existingLoan}
                    }
                );
        }

        await db.collection('loans')
            .updateOne(
                { _id: new ObjectId(lId) },
                {
                    $set: {...loan}
                }
            );   
    }
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

async function saveCashCollection(loan) {
    const { db } = await connectToDatabase();

    let groupSummary = await db.collection('groupCashCollections').find({ dateAdded: currentDate, groupId: loan.groupId }).toArray();

    if (groupSummary.length > 0) {
        groupSummary = groupSummary[0];
        
        let loanData = await db.collection("loans")
            .aggregate([
                { $match: { $expr: { $and: [{$eq: ['$clientId', loan.clientId]}, {$eq: ['$status', "active"]}] } } },
                {
                    $addFields: { clientIdObj: { $toObjectId: "$clientId" }, groupIdObj: { $toObjectId: "$groupId" } }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: "groupIdObj",
                        foreignField: "_id",
                        as: "groups"
                    }
                }
            ]).toArray();

        if (loanData.length > 0) {
            loanData = loanData[0];

            const status = loanData.status === "active" ? "tomorrow" : loanData.status;

            let cashCollection = await db.collection('cashCollections').find({ groupCollectionId: groupSummary._id + '', clientId: loan.clientId, dateAdded: currentDate }).toArray();

            if (cashCollection.length > 0) {
                cashCollection = cashCollection[0];
                const ccId = cashCollection._id;
                delete cashCollection._id;

                // cashCollection.currentReleaseAmount = cashCollection.amountRelease;

                await db.collection('cashCollections')
                    .updateOne(
                        { _id: ccId }, 
                        {
                            $set: { ...cashCollection, status: status }
                        }, 
                        { upsert: false }
                    );
            } else {
                // this entry is only when the approve or reject is not the same day when it applies
                let data = {
                    loanId: loanData._id + '',
                    branchId: loanData.branchId,
                    groupId: loanData.groupId,
                    groupname: loanData.groupName,
                    loId: loanData.loId,
                    clientId: loanData.clientId,
                    slotNo: loanData.slotNo,
                    fullName: loanData.client.length > 0 ? loanData.client[0].lastName + ', ' + loanData.client[0].firstName : '',
                    loanCycle: loanData.loanCycle,
                    mispayment: false,
                    mispaymentStr: 'No',
                    collection: 0,
                    excess: 0,
                    total: 0,
                    noOfPayments: 0,
                    activeLoan: loanData.activeLoan,
                    targetCollection: loanData.activeLoan,
                    amountRelease: loanData.amountRelease,
                    loanBalance: loanData.loanBalance,
                    paymentCollection: 0,
                    occurence: groupSummary.mode,
                    currentReleaseAmount: loanData.amountRelease,
                    fullPayment: 0,
                    remarks: '',
                    mcbu: loanData.mcbu,
                    mcbuCol: 0,
                    mcbuWithdrawal: 0,
                    mcbuReturnAmt: 0,
                    status: status,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD'),
                    groupCollectionId: groupSummary._id + '',
                    origin: 'automation'
                };

                if (data.loanCycle === 1 && data.occurence === 'weekly') {
                    data.mcbuCol = loanData.mcbu;
                }

                if (data.occurence === 'weekly') {
                    data.mcbuTarget = 50;
                    data.groupDay = loanData.groups[0].day;
                }
    
                await db.collection('cashCollections').insertOne({ ...data });
            }
        }
    }
}