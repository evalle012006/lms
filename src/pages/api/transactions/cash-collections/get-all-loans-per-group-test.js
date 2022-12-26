import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';


export default apiHandler({
    get: getAllLoansPerGroup
});

async function getAllLoansPerGroup(req, res) {
    const { db } = await connectToDatabase();

    const { date, mode, branchId, branchCode, loId, groupId } = req.query;
    let statusCode = 200;
    let response = {};
    let cashCollection;

    const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

    if (branchCode) {
        const cashCollectionGroups = await db
            .collection('users')
            .aggregate([
                
            ])
            .toArray();
        let totals = await db.collection('cashCollectionTotals')
            .aggregate([
                // { $match: { loId: loId, dateAdded: { $gte: startOfMonth, $lte: endOfMonth } } }, this is for LOS
                { $match: { loId: loId, dateAdded: date } },
                {
                    $group: {
                        _id: null,
                        noOfNewCurrentRelease: { $sum: '$noNewCurrentRelease' },
                        noOfReCurrentRelease: { $sum: '$noReCurrentRelease' },
                        currentReleaseAmount: { $sum: '$currentReleaseAmount' },
                        activeClients: { $sum: '$activeClients' },
                        activeBorrowers: { $sum: '$activeBorrowers' },
                        totalsLoanRelease: { $sum: '$amountRelease' },
                        totalLoanBalance: { $sum: '$loanBalance' },
                        mispayment: { $sum: '$mispaymentStr' },
                        loanTarget: { $sum: '$targetCollection' },
                        collection: { $sum: '$paymentCollection' },
                        fullPaymentAmount: { $sum: '$fullPayment' },
                        noOfFullPayment: { $sum: '$noOfFullPayment' },
                        excess: { $sum: '$excess' }
                    }
                }
            ]).toArray();
        
        totals = totals.length > 0 ? totals[0] : [];

        cashCollection = {
            cashCollectionGroups: cashCollectionGroups,
            totals: totals
        }
    } else if (loId) {
        const cashCollectionGroups = await db
            .collection('groups')
            .aggregate([
                { $match: { loanOfficerId: loId, occurence: mode } },
                {
                    $addFields: {
                        "groupIdStr": { $toString: "$_id" }
                    }
                },
                {
                    $lookup: {
                        from: "groupCashCollections",
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: 'groupCashCollections'
                    }
                },
                {
                    $lookup: {
                        from: "cashCollectionTotals",
                        localField: "groupIdStr",
                        foreignField: "groupId",
                        pipeline: [
                            { $match: { dateAdded: date } }
                        ],
                        as: "cashCollectionPerGroup"
                    }
                }
            ])
            .toArray();
        let totals = await db.collection('cashCollectionTotals')
            .aggregate([
                // { $match: { loId: loId, dateAdded: { $gte: startOfMonth, $lte: endOfMonth } } }, this is for LOS
                { $match: { loId: loId, dateAdded: date } },
                {
                    $group: {
                        _id: null,
                        noOfNewCurrentRelease: { $sum: '$noNewCurrentRelease' },
                        noOfReCurrentRelease: { $sum: '$noReCurrentRelease' },
                        currentReleaseAmount: { $sum: '$currentReleaseAmount' },
                        activeClients: { $sum: '$activeClients' },
                        activeBorrowers: { $sum: '$activeBorrowers' },
                        totalsLoanRelease: { $sum: '$amountRelease' },
                        totalLoanBalance: { $sum: '$loanBalance' },
                        mispayment: { $sum: '$mispaymentStr' },
                        loanTarget: { $sum: '$targetCollection' },
                        collection: { $sum: '$paymentCollection' },
                        fullPaymentAmount: { $sum: '$fullPayment' },
                        noOfFullPayment: { $sum: '$noOfFullPayment' },
                        excess: { $sum: '$excess' }
                    }
                }
            ]).toArray();
        
        totals = totals.length > 0 ? totals[0] : [];

        cashCollection = {
            cashCollectionGroups: cashCollectionGroups,
            totals: totals
        }
    } 

        
    response = { success: true, data: cashCollection };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}