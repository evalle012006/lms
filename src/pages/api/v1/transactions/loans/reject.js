import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';

export default apiHandler({
    post: updateLoan
});

async function updateLoan(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    let loan = req.body;
    const loanId = loan._id;
    const currentDate = loan.currentDate;

    delete loan._id;
    delete loan.loanOfficer;
    delete loan.groupCashCollections;
    delete loan.loanReleaseStr;
    delete loan.allowApproved;
    delete loan.currentDate;
    delete loan.groupStatus;
    delete loan.selected;

    let groupData = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
    if (groupData.length > 0) {
        groupData = groupData[0];
        if (loan.status === 'active') {
            await updateClient(loan.clientId);
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
            logger.debug({page: `Rejecting Loan: ${loanId}`, data: loan});
            // if reloan cashCollections:
            // status to completed
            // currentReleaseAmount to 0
            // in loans, change back the previous loan to completed status and the current one change the loanCycle to 0
            // client status to pending
            if (loan.loanCycle > 1) {
                let prevLoan = await db.collection('loans').find({ clientId: loan.clientId, loanCycle: loan.loanCycle - 1, groupId: loan.groupId }).toArray();
                logger.debug({page: `Rejecting Loan: ${loanId}`, message: 'Previous Loan', data: prevLoan});
                if (prevLoan && prevLoan?.length > 0) {
                    prevLoan = prevLoan[0];
                    let cashCollection = await db.collection('cashCollections')
                                            .aggregate([
                                                { $match: { $expr: { $and: [
                                                    { $eq: ['$clientId', loan.clientId] },
                                                    { $eq: ['$dateAdded', currentDate] },
                                                    { $eq: ['$groupId', loan.groupId] }
                                                ] } } }
                                            ])
                                            .toArray();
                    logger.debug({page: `Rejecting Loan: ${loan._id}`, message: 'Cash Collection Data', data: cashCollection});
                    if (cashCollection.length > 0) {
                        cashCollection = cashCollection[0];
                        cashCollection.status = cashCollection.loanBalance <= 0 ? 'completed' : 'active';
                        cashCollection.currentReleaseAmount = 0;
                        cashCollection.loanId = prevLoan._id + "";
                        const ccId = cashCollection._id;
                        delete cashCollection._id;
                        delete cashCollection.prevLoanId;
                        await db.collection('cashCollections').updateOne({ _id: ccId }, { $unset: { prevLoanId: 1 }, $set: { ...cashCollection } });
                    }

                    const prevLoanId = prevLoan._id;
                    delete prevLoan._id;
                    if (prevLoan.loanBalance <= 0 && prevLoan.fullPaymentDate) {
                        prevLoan.status = 'completed';
                        prevLoan.mcbu = loan.mcbu ? loan.mcbu : 0;
                        prevLoan.mcbuCollection = loan.mcbu ? loan.mcbu : 0;
                    } else {
                        prevLoan.status = 'active';
                    }

                    delete prevLoan.advance;
                    delete prevLoan.advanceDate;
                    
                    await db.collection('loans').updateOne({ _id: prevLoanId }, {$unset: {advance: 1, advanceDate: 1}, $set: { ...prevLoan }});
                }
            } else {
                logger.debug({page: `Rejecting Loan: ${loanId}`, message: 'Deleting cashCollection data.'});
                await db.collection('cashCollections').deleteOne({ loanId: loan._id });
            }

            // let client = await db.collection('client').find({ _id: new ObjectId(loan.clientId) }).toArray();
            // if (client && loan.loanCycle == 1) {
            //     client = client[0];
            //     client.status = 'pending';

            //     delete client._id;
            //     await db.collection('client').updateOne({ _id: new ObjectId(loan.clientId) }, { $set: { ...client } });
            // }

            loan.loanCycle = 0;

            if (!groupData.availableSlots.includes(loan.slotNo)) {
                groupData.availableSlots.push(loan.slotNo);
                groupData.availableSlots.sort((a, b) => { return a - b; });
                groupData.noOfClients = groupData.noOfClients - 1;
                groupData.status = groupData.status === 'full' ? 'available' : groupData.status;
                await updateGroup(groupData);
            }
        }

        if (loan.status === 'active' || loan.status === 'reject') {
            logger.debug({page: `Loan: ${loanId}`, message: 'Updating loan data.', status: loan.status});
            await db
                .collection('loans')
                .updateOne(
                    { _id: new ObjectId(loanId) }, 
                    {
                        $set: { ...loan }
                    }, 
                    { upsert: false });

            loan._id = loanId;
            if (loan.status == 'active') {
                await saveCashCollection(loan, groupData, currentDate);
            }
        }

        response = { success: true };   
    } else {
        response = { error: true, message: 'Group data not found.' };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
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
            mcbu: loan.mcbu ? loan.mcbu : 0,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            status: status,
            dateAdded: currentDate,
            groupStatus: 'pending',
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