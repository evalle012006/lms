import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response = {};
    let statusCode = 200;
    const { loId, currentDate } = req.body;

    const loans = await db.collection('loans')
        .aggregate([
            { $match: {$expr: {
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
            }} },
            { $addFields: { 'groupIdObj': { $toObjectId: '$groupId' } } },
            {
                $lookup: {
                    from: "groups",
                    localField: "groupIdObj",
                    foreignField: "_id",
                    as: "group"
                }
            },
            { $unwind: "$group" },
            { $project: { groupIdObj: 0 } }
        ]
        ).toArray();

    loans.map(async loan => {
        const existCC = await db.collection('cashCollections').find({ clientId: loan.clientId + '', dateAdded: currentDate }).toArray();

        if (existCC.length === 0) {
            // const group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
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
                occurence: loan.group.occurence,
                currentReleaseAmount: 0,
                mcbuTarget: 50,
                groupDay: loan.group.day,
                fullPayment: 0,
                mcbu: loan.mcbu,
                mcbuCol: 0,
                mcbuWithdrawal: 0,
                mcbuReturnAmt: 0,
                remarks: '',
                status: loan.status,
                dateAdded: currentDate,
                groupStatus: "pending",
                insertedDateTime: new Date(),
                origin: 'pre-save'
            };

            await db.collection('cashCollections').insertOne({ ...data });
        }
    });

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}