import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

const currentDate = moment(new Date()).format('YYYY-MM-DD');

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
                    await updateExistingLoan(loan.clientId);
                    await saveUpdateTotals(loan, groupData);
                }  else if (loan.status === 'reject') {
                    if (!groupData.availableSlots.includes(loan.slotNo)) {
                        groupData.availableSlots.push(loan.slotNo);
                        groupData.availableSlots.sort((a, b) => { return a - b; });
                        groupData.noOfClients = groupData.noOfClients - 1;
                        groupData.status = groupData.status === 'full' ? 'available' : groupData.status;
                        await updateGroup(groupData);
                    }
                }
                
                await updateLoan(loanId, loan);
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

    const groupData = await db.collection('groups').find({ _id: ObjectId(groupId) }).toArray();

    return groupData;
}

async function updateLoan(loanId, loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    await db.collection('loans')
            .updateOne(
                { _id: ObjectId(loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
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

async function saveCashCollection(loan) {
    const { db } = await connectToDatabase();

    let groupSummary = await db.collection('groupCashCollections').find({ dateAdded: currentDate, groupId: loan.groupId }).toArray();

    if (groupSummary.length > 0) {
        groupSummary = groupSummary[0];

        let loanData = await db.collection("loans")
            .aggregate([
                { $match: {clientId: loan.clientId, status: "active"} },
                {
                    $addFields: { clientIdObj: { $toObjectId: "$clientId" } }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
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

                cashCollection.currentReleaseAmount = cashCollection.amountRelease;

                await db.collection('cashCollections')
                    .updateOne(
                        { _id: ccId }, 
                        {
                            $set: { ...cashCollection, status: status }
                        }, 
                        { upsert: false }
                    );
            } else {
                const data = {
                    loanId: loanData._id + '',
                    branchId: loanData.branchId,
                    groupId: loanData.groupId,
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
                    status: status,
                    dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                    groupCollectionId: groupSummary._id + '',
                    origin: 'automation'
                };
    
                await db.collection('cashCollections').insertOne({ ...data });
            }
        }
    }
}


async function saveUpdateTotals (loan, group) {
    const { db } = await connectToDatabase();

    const currentTotal = await db.collection('cashCollectionTotals').find({ dateAdded: currentDate, groupId: loan.groupId }).toArray();

    if (currentTotal.length > 0) {
        const existActiveClients = currentTotal[0].activeClients ? currentTotal[0].activeClients : 0;
        const activeClients = existActiveClients + 1;
        const existActiveBorrowers = currentTotal[0].activeBorrowers ? currentTotal[0].activeBorrowers : 0;
        const activeBorrowers = existActiveBorrowers + 1;
        let noNewCurrentRelease = currentTotal[0].noNewCurrentRelease;
        let noReCurrentRelease = currentTotal[0].noReCurrentRelease;
        const existingCurrentReleaseAmount = currentTotal[0].currentReleaseAmount ? currentTotal[0].currentReleaseAmount : 0;
        const currentReleaseAmount = existingCurrentReleaseAmount + loan.amountRelease;

        if (loan.loanCycle === 1) {
            noNewCurrentRelease += 1;
        } else if (loan.loanCycle > 1) {
            noReCurrentRelease += 1;
        }
        const noCurrentReleaseStr = noNewCurrentRelease + " / " + noReCurrentRelease;
        const totalData = {
            ...currentTotal[0], 
            activeClients: activeClients,
            activeBorrowers: activeBorrowers,
            noNewCurrentRelease: noNewCurrentRelease, 
            noReCurrentRelease: noReCurrentRelease, 
            noCurrentReleaseStr: noCurrentReleaseStr,
            currentReleaseAmount: currentReleaseAmount,
            dateModified: currentDate
        };
        delete totalData._id;
        await db.collection('cashCollectionTotals').updateOne({ _id: currentTotal[0]._id }, { $set: { ...totalData } }, { upsert: false });
    } else {
        let noNewCurrentRelease = 0;
        let noReCurrentRelease = 0;
        if (loan.loanCycle === 1) {
            noNewCurrentRelease += 1;
        } else if (loan.loanCycle > 1) {
            noReCurrentRelease += 1;
        }
        const noCurrentReleaseStr = noNewCurrentRelease + " / " + noReCurrentRelease;
        const totalData = {
            branchId: group.branchId,
            groupId: group._id + "",
            loId: group.loanOfficerId,
            mode: group.occurence,
            activeClients: 1,
            activeBorrowers: 0,
            noNewCurrentRelease: noNewCurrentRelease,
            noReCurrentRelease: noReCurrentRelease,
            noCurrentReleaseStr: noCurrentReleaseStr,
            noOfFullPayment: 0,
            currentReleaseAmount: loan.amountRelease,
            loanBalance: 0,
            mispaymentStr: 0,
            targetCollection: 0,
            excess: 0,
            paymentCollection: 0,
            fullPayment: 0,
            dateAdded: currentDate,
        }
        await db.collection('cashCollectionTotals').insertOne({ ...totalData });
    }
}