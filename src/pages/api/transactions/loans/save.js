import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';

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
    delete loanData.pendings;
    delete loanData.origin;

    if (loanData.hasOwnProperty('mode')) {
        mode = loanData.mode;
        oldLoanId = loanData.oldLoanId;
        delete loanData.mode;
        delete loanData.oldLoanId;
        delete loanData.groupCashCollections;
        delete loanData.loanOfficer;
    }
    logger.debug({page: `Saving Loan: ${loanData.clientId}`, mode: mode, data: loanData});
    const spotExist = await db.collection('loans').find({ $expr: { $and: [{$eq: ["$slotNo", loanData.slotNo]}, {$eq: ["$groupId", loanData.groupId]}, { $or: [{$eq: ["$status", "active"]}, {$eq: ["$status", "completed"]}, {$eq: ["$status", "pending"]}] }] } }).toArray();
    const pendingExist = await db.collection('loans').find({ slotNo: loanData.slotNo, clientId: loanData.clientId, status: 'pending' }).toArray();

    if ((mode !== 'reloan' && mode !== 'advance' && mode !== 'active') && spotExist.length > 0) {
        response = {
            error: true,
            fields: [['slotNo']],
            message: `Slot Number ${loanData.slotNo} is already taken in group ${loanData.groupName}`
        };
    } else if (pendingExist.length > 0) {
        response = {
            error: true,
            fields: [['clientId']],
            message: `Client has a PENDING release already!`
        };
    } else {
        const loans = await db
            .collection('loans')
            .find({ clientId: loanData.clientId, status: 'active' })
            .toArray();

        if (loans.length > 0 && mode !== 'advance') {
            response = {
                error: true,
                fields: ['clientId'],
                message: `Client ${loanData.fullName} already have an active loan`
            };
        } else {
            let finalData = {...loanData};
            if (finalData.occurence === 'weekly') {
                if (finalData.loanCycle == 1) {
                    finalData.mcbu = 50;
                    finalData.mcbuCollection = 50;
                }
                finalData.mcbuTarget = 50;
            }

            if (mode === 'reloan') {
                finalData.modifiedDateTime = new Date();
            }
            logger.debug({page: `Saving Loan: ${loanData.clientId}`, message: 'Final Data', data: finalData});
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
            } else if (mode == 'advance' || mode == 'active') {
                await updateLoan(oldLoanId, finalData, currentDate, mode);
            } else {
                await updateGroup(loanData);
            }

            if (mode != 'advance' && mode !== 'active') {
                await saveCashCollection(loanData, reloan, group, loanId, currentDate);
                // await updateUser(loanData);
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

async function updateLoan(loanId, loanData, currentDate, mode) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let loan = await db.collection('loans').find({ _id: new ObjectId(loanId) }).toArray();
    logger.debug({page: `Updating Old Loan: ${loanId}`, mode: mode, data: loan});
    if (loan.length > 0) {
        loan = loan[0];

        delete loan.loanOfficer;
        delete loan.groupCashCollections;

        if (mode == 'advance' || mode == 'active') {
            loan.advance = true;
            loan.advanceDate = currentDate;
        } else {
            loan.mcbu = loan.mcbu - loanData.mcbu;
            loan.status = 'closed';
            logger.debug({page: `Updating Cash Collection: ${loanId}`, data: loan});
            await db
                .collection('cashCollections')
                .updateOne(
                    { loanId: loanId, dateAdded: currentDate },
                    { $set: { status: 'closed' } }
                );   
        }

        await db
            .collection('loans')
            .updateOne(
                { _id: new ObjectId(loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
    }
}

async function saveCashCollection(loan, reloan, group, loanId, currentDate) {
    const { db } = await connectToDatabase();

    const currentReleaseAmount = loan.amountRelease;

    const cashCollection = await db.collection('cashCollections').find({ clientId: loan.clientId, dateAdded: currentDate }).toArray();
    const groupCashCollections = await db.collection('cashCollections').find({ groupId: group._id, dateAdded: currentDate }).toArray();
    logger.debug({page: `Saving Cash Collection: ${loanId}`, cashCollection: cashCollection, groupCashCollections: groupCashCollections});
    if (groupCashCollections && cashCollection.length === 0) {
        let groupStatus = 'pending';
        if (groupCashCollections.length > 0) {
            groupStatus = groupCashCollections[0].groupStatus;
        }

        let mcbu = loan.mcbu ? loan.mcbu : 0;
        let mcbuCol = 0;

        if (loan.loanCycle == 1) {
            groupStatus = 'closed';
            if (loan.occurence == 'weekly') {
                mcbu = 50;
                mcbuCol = 50;
            }
        }

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
            mcbu: mcbu,
            mcbuCol: mcbuCol,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            remarks: '',
            status: loan.status,
            dateAdded: currentDate,
            insertedDateTime: new Date(),
            groupStatus: groupStatus,
            origin: 'automation-loan'
        };

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = group.day;

            if (!reloan && data.loanCycle !== 1) {
                data.mcbuCol = loan.mcbu ? loan.mcbu : 0;
            }
        }

        if (loan.status === 'reject') {
            data.rejectReason = loan.rejectReason;
        }
        logger.debug({page: `Saving Cash Collection: ${loan.clientId}`, data: data});
        await db.collection('cashCollections').insertOne({ ...data });
    } else {
        logger.debug({page: `Updating Loan: ${loan.clientId}`});
        await db.collection('cashCollections').updateOne({ _id: cashCollection[0]._id }, { $set: { currentReleaseAmount: currentReleaseAmount, status: loan.status, modifiedBy: 'automation-loan', modifiedDateTime: new Date() } })
    }
}