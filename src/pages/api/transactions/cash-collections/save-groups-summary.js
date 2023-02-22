import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: processLOSummary
});

async function processLOSummary(req, res) {
    const { db } = await connectToDatabase();
    const { _id, groupSummaryIds, status, mode, currentUser, branchId } = req.body;

    let groups;
    if (branchId) {
        groups = await db.collection('groups').find({ $expr: { $and: [{$eq: ['$branchId', branchId] }, {$gt: ['$noOfClients', 0]}, {$eq: ['$mode', mode]}] } }).toArray();
    } else {
        groupSummaryIds.map(async gs => {
            const data = {
                _id: gs._id,
                status: status,
                modifiedBy: currentUser
            };
    
            await update(data);
        });
    
        groups = await db.collection('groups').find({ loanOfficerId: _id }).toArray();
    }

    if (groups.length > 0) {
        groups.map(async group => {
            const exist = await db.collection('groupCashCollections').find({ dateAdded: moment(new Date()).format('YYYY-MM-DD'), groupId: group._id + '' }).toArray();
            if (exist.length === 0 && (group.noOfClients && group.noOfClients > 0)) {
                const data = {
                    branchId: group.branchId,
                    groupId: group._id + '',
                    groupName: group.name,
                    loId: _id,
                    dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                    insertBy: currentUser,
                    mode: mode,
                    status: status
                };
    
                await save(data);
            }

            // await saveCashCollections(group);
        });
    }

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function save(data) {
    const { db } = await connectToDatabase();
    const groups = await db.collection('groupCashCollections')
        .insertOne({
            ...data
        });
    
    response = { success: true, groups };
}

async function update(data) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let groupCC = await db.collection('groupCashCollections').find({ _id: ObjectId(data._id) }).toArray();

    if (groupCC.length > 0) {
        groupCC = {
            ...groupCC[0], 
            status: data.status, 
            modifiedBy: data.modifiedBy, 
            dateModified: moment(new Date()).format('YYYY-MM-DD')};
        
        delete groupCC._id;

        await db.collection('groupCashCollections')
            .updateOne(
                { _id: ObjectId(data._id) }, 
                {
                    $set: { ...groupCC }
                }, 
                { upsert: false }
            );
    }
    
    response = { success: true };
}

async function saveCashCollections(group) {
    const { db } = await connectToDatabase();
    const groupId = group._id + '';
    const cashCollections = await db.collection('cashCollections').find({ groupId: groupId }).toArray();

    if (cashCollections.length === 0) {
        let groupHeader = await db.collection('groupCashCollections').find({ groupId: groupId, dateAdded: moment(new Date()).format('YYYY-MM-DD') }).toArray();

        if (groupHeader.length > 0) {
            groupHeader = groupHeader[0];
            const tomorrowDate = moment(new Date()).add(1, 'days').format('YYYY-MM-DD');
            const loans = await db.collection('loans')
                .find({ 
                        $expr: {
                            $and: [
                                { $eq: ['$groupId', groupId] }, 
                                { $or: [
                                    { $eq: ['$status', 'pending'] }, 
                                    { $eq: ['$status', 'active'] }, 
                                    { $eq: ['$startDate', tomorrowDate] }
                                ]}
                            ]
                        }
                }).toArray();

            if (loans.length > 0) {
                const currentDate = new Date();
                loans.map(async loan => {
                    let status;
                    if (loan.status === 'active') {
                        if (new Date(loan.startDate).getTime() <= currentDate.getTime()) {
                            status = 'active';
                        } else {
                            status = 'tomorrow';
                        }
                    } else {
                        status = 'pending';
                    }
                    const data = {
                        loanId: loan._id + '',
                        branchId: loan.branchId,
                        groupId: loan.groupId,
                        clientId: loan.clientId,
                        slotNo: loan.slotNo,
                        fullName: loan.fullName,
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
                        currentReleaseAmount: 0,
                        fullPayment: 0,
                        remarks: '',
                        status: status,
                        dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                        groupCollectionId: groupHeader && groupHeader._id + '',
                        origin: 'automation'
                    };

                    await db.collection('cashCollections').insertOne({ ...data });
                });
            }
        }
    }
}