import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const loanData = req.body;

    const { db } = await connectToDatabase();
    let response = {};
    let statusCode = 200;

    let mode;
    let oldLoanId;
    let reloan = false;
    
    if (loanData.hasOwnProperty('mode')) {
        mode = loanData.mode;
        oldLoanId = loanData.oldLoanId;
        delete loanData.mode;
        delete loanData.oldLoanId;
        delete loanData.groupCashCollections;
        delete loanData.loanOfficer;
    }

    const spotExist = await db.collection('loans').find({ $expr: { $and: [{$eq: ["$slotNo", loanData.slotNo]}, {$eq: ["$groupId", loanData.groupId]}, { $or: [{$eq: ["$status", "active"]}, {$eq: ["$status", "completed"]}] }] } }).toArray();

    if (mode !== 'reloan' && spotExist.length > 0) {
            response = {
                error: true,
                fields: [['slotNo']],
                message: `Slot Number ${loanData.slotNo} is already taken in group ${loanData.groupName}`
            };
    } else {
        const loans = await db
            .collection('loans')
            .find({ clientId: loanData.clientId, status: 'active' })
            .toArray();

        

        if (loans.length > 0) {
            response = {
                error: true,
                fields: ['clientId'],
                message: `Client ${loanData.fullName} already have an active loan`
            };
        } else {
            const loan = await db.collection('loans').insertOne({
                ...loanData,
                dateGranted: moment(new Date()).format('YYYY-MM-DD')
            });

            if (mode === 'reloan') {
                reloan = true;
                await updateLoan(oldLoanId);
            } else {
                await updateGroup(loanData);
            }

            const groupSummary = await saveGroupSummary(loanData);

            if (groupSummary.success) {
                await saveCashCollection(loanData, reloan);
            }

            response = {
                success: true,
                loan: loan
            }
        }
    }
    

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let group = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();
    if (group.length > 0) {
        group = group[0];
        group.noOfClients = group.noOfClients ? group.noOfClients : 0;

        group.availableSlots = group.availableSlots.filter(s => s !== loan.slotNo);
        group.noOfClients = group.noOfClients + 1;

        if (group.noOfClients === group.capacity) {
            group.status = 'full';
        }

        delete group._id;
        await db.collection('groups').updateOne(
            {  _id: ObjectId(loan.groupId) },
            {
                $set: { ...group }
            }, 
            { upsert: false }
        );
    }
}

async function updateLoan(loanId) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: ObjectId(loanId) }).toArray();

    if (loan.length > 0) {
        loan = loan[0];

        loan.status = 'closed';

        await db
            .collection('loans')
            .updateOne(
                { _id: ObjectId(loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
    }
}

async function saveGroupSummary(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const groupSummary = await db.collection('groupCashCollections').find({ dateAdded: moment(new Date()).format('YYYY-MM-DD'), groupId: loan.groupId }).toArray();

    if (groupSummary.length === 0) {
        let group = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();

        if (group.length > 0) {
            group = group[0];

            const data = {
                branchId: loan.branchId,
                groupId: loan.groupId,
                groupName: group.name,
                loId: group.loanOfficerId,
                dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                insertBy: loan.insertedBy,
                mode: group.occurence,
                status: "pending"
            };

            const resp = await db.collection('groupCashCollections').insertOne({ ...data });

            return { success: true, data: resp };
        }
    }

    return { success: true };
}

async function saveCashCollection(loan, reloan) {
    const { db } = await connectToDatabase();
    const currentDate = moment(new Date()).format('YYYY-MM-DD');

    let groupSummary = await db.collection('groupCashCollections').find({ dateAdded: currentDate, groupId: loan.groupId }).toArray();

    if (groupSummary.length > 0) {
        groupSummary = groupSummary[0];

        let loanData = await db.collection("loans")
            .aggregate([
                { $match: {clientId: loan.clientId, status: "pending"} },
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
            const cashCollection = await db.collection('cashCollections').find({ groupCollectionId: groupSummary._id + '', clientId: loanData.clientId, dateAdded: currentDate }).toArray();
            if (cashCollection.length === 0) {
                const data = {
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
                    excess: loanData.excess,
                    total: 0,
                    noOfPayments: 0,
                    activeLoan: loanData.activeLoan,
                    targetCollection: loanData.activeLoan,
                    amountRelease: loanData.amountRelease,
                    loanBalance: loanData.loanBalance,
                    paymentCollection: 0,
                    occurence: groupSummary.mode,
                    currentReleaseAmount: loanData.currentReleaseAmount,
                    fullPayment: loanData.fullPayment,
                    remarks: '',
                    status: loanData.status,
                    dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                    groupCollectionId: groupSummary._id + '',
                    origin: 'automation'
                };
    
                await db.collection('cashCollections').insertOne({ ...data });
            } else {
                await db.collection('cashCollections').updateOne({ _id: cashCollection[0]._id }, { $set: { currentReleaseAmount: loanData.amountRelease } })
            }
        }
    }
}