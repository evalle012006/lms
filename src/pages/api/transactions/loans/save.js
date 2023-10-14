import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    let response = {};
    let statusCode = 200;

    const loanData = req.body;
    const group = loanData.group;

    let mode;
    let oldLoanId;
    let reloan = false;

    const currentDate = loanData.currentDate;

    delete loanData.currentDate;
    delete loanData.group;
    delete loanData.groupStatus;
    
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
            const currentReleaseAmount = loanData.currentReleaseAmount;
            let finalData = {...loanData};
            if (finalData.occurence === 'weekly') {
                finalData.mcbuTarget = 50;
            }

            if (mode === 'reloan') {
                finalData.modifiedDateTime = new Date();
            }

            delete finalData.currentReleaseAmount;
            delete finalData.currentDate;
            const loan = await db.collection('loans').insertOne({
                ...finalData,
                dateGranted: currentDate,
                insertedDateTime: new Date()
            });

            let loanId;
            if (loan.acknowledged) {
                loanId = loan.insertedId + "";
            }

            if (mode === 'reloan') {
                reloan = true;
                await updateLoan(oldLoanId, finalData, currentDate);
            } else {
                await updateGroup(loanData);
            }

            await saveCashCollection(loanData, currentReleaseAmount, reloan, group, loanId, currentDate, mode);

            await updateUser(loanData);

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

// this will reflect on next login
async function updateUser(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let user = await db.collection('users').find({ _id: new ObjectId(loan.loId) }).toArray();
    if (user.length > 0) {
        user = user[0];
        
        if (!user.hasOwnProperty('transactionType')) {
            user.transactionType = loan.occurence;

            delete user._id;
            await db.collection('users').updateOne(
                {  _id: new ObjectId(loan.loId) },
                {
                    $set: { ...user }
                }, 
                { upsert: false }
            );
        }
    }
}


async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
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
            {  _id: new ObjectId(loan.groupId) },
            {
                $set: { ...group }
            }, 
            { upsert: false }
        );
    }
}

async function updateLoan(loanId, loanData, currentDate) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();

    if (loan.length > 0) {
        loan = loan[0];

        loan.mcbu = loan.mcbu - loanData.mcbu;
        loan.status = 'closed';

        delete loan.loanOfficer;
        delete loan.groupCashCollections;

        await db
            .collection('loans')
            .updateOne(
                { _id: new ObjectId(loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });

        await db
            .collection('cashCollections')
            .updateOne(
                { loanId: loanId, dateAdded: currentDate },
                { $set: { status: 'closed' } }
            );
    }
}

async function saveCashCollection(loan, currentReleaseAmount, reloan, group, loanId, currentDate, mode) {
    const { db } = await connectToDatabase();

    const cashCollection = await db.collection('cashCollections').find({ clientId: loan.clientId, dateAdded: currentDate }).toArray();
    if (cashCollection.length === 0) {
        let data = {
            loanId: loanId,
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
            excess: loan.excess,
            total: 0,
            noOfPayments: 0,
            activeLoan: 0,
            targetCollection: 0,
            amountRelease: 0,
            loanBalance: 0,
            paymentCollection: 0,
            occurence: group.occurence,
            currentReleaseAmount: currentReleaseAmount,
            fullPayment: loan.fullPayment,
            mcbu: loan.mcbu,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            remarks: '',
            status: loan.status,
            dateAdded: currentDate,
            insertedDateTime: new Date(),
            groupStatus: (mode === 'add' && loan.status === 'pending') ? 'closed' : 'pending',
            origin: 'automation-loan'
        };

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = group.day;

            if (!reloan) {
                data.mcbuCol = loan.mcbu;
            }
        }

        await db.collection('cashCollections').insertOne({ ...data });
    } else {
        await db.collection('cashCollections').updateOne({ _id: cashCollection[0]._id }, { $set: { currentReleaseAmount: currentReleaseAmount, status: loan.status, modifiedBy: 'automation-loan', modifiedDateTime: new Date() } })
    }
}