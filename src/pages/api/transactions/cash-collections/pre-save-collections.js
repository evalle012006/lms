import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response = {};
    let statusCode = 200;
    const { loId, currentUser } = req.body;
    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

    const loans = await db.collection('loans').find(
            {$expr: {
                $and: [
                    {$eq: ['$loId', loId]},
                    {$or: [
                        {$eq: ['$status', 'active']},
                        {$eq: ['$status', 'completed']},
                        {$and: [
                            {$eq: ['$status', 'closed']},
                            {$eq: ['$fullPaymentDate', currentDate]}
                        ]}
                    ]}
                ]
            }}
        ).toArray();

    loans.map(async loan => {
        const existCC = await db.collection('cashCollections').find({ loanId: loan._id + '', dateAdded: currentDate }).toArray();

        if (existCC.length === 0) {
            const groupSummary = await db.collection('groupCashCollections').find({ groupId: loan.groupId, dateAdded: currentDate }).toArray();
            const group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
            if (groupSummary.length > 0) {
                let data = {
                    loanId: loan._id + '',
                    branchId: loan.branchId,
                    groupId: loan.groupId,
                    groupname: loan.groupName,
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
                    occurence: loan.occurence,
                    currentReleaseAmount: 0,
                    fullPayment: 0,
                    mcbu: loan.mcbu,
                    mcbuCol: 0,
                    mcbuWithdrawal: 0,
                    mcbuReturnAmt: 0,
                    remarks: '',
                    status: loan.status,
                    dateAdded: currentDate,
                    groupCollectionId: groupSummary[0]._id + '',
                    groupStatus: "pending",
                    origin: 'pre-save'
                };

                if (loan.occurence === 'weekly') {
                    data.mcbuTarget = 50;
                    data.groupDay = group[0].day;
                }
    
                await db.collection('cashCollections').insertOne({ ...data });
            }
        }
    });

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}