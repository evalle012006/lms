import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { date, userId, branchId, occurence } = req.query;
    let statusCode = 200;
    let response = {};
    let data;

    const user = await db.collection('users').find({ _id: ObjectId(userId) }).toArray();

    if (user.length > 0) {
        const currentMonth = moment(date).month() + 1;
        const currentYear = moment(date).year();

        const lastMonth = moment(date).subtract(1, 'months').month() + 1;
        const lastYear = lastMonth === 12 ? moment(date).subtract(1, 'years').year() : moment(date).year();

        const userId = user[0]._id + '';

        let fBalance = [];
        let summary = [];

        if (user[0].role.rep === 3) {
            fBalance = await db.collection('losTotals').find({ userId: userId, month: lastMonth, year: lastYear, losType: 'commulative' }).toArray();
            summary = await db.collection('losTotals').aggregate([
                { $match: { branchId: branchId, month: currentMonth, year: currentYear, losType: 'daily', userType: 'lo' } },
                { $sort: { dateAdded: 1 } },
                {
                    $group: {
                        _id: {branchId: '$branchId', dateAdded: '$dateAdded'},
                        transfer: { $sum: '$data.transfer' },
                        newMember: { $sum: '$data.newMember' },
                        mcbuTarget: { $sum: { $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: { $multiply: ['$data.activeClients', 50] },
                            else: { $multiply: ['$data.activeClients', 10] }
                        } } },
                        mcbuActual: { $sum: '$data.mcbuActual' },
                        mcbuWithdrawal: { $sum: '$data.mcbuWithdrawal' },
                        mcbuInterest: { $sum: '$data.mcbuInterest' },
                        noMcbuReturn: { $sum: '$data.noMcbuReturn' },
                        mcbuReturnAmt: { $sum: '$data.mcbuReturnAmt' },
                        mcbuBalance: { $sum: '$data.mcbuBalance' },
                        offsetPerson: { $sum: '$data.offsetPerson' },
                        activeClients: { $sum: '$data.activeClients' },
                        loanReleasePerson: { $sum: '$data.loanReleasePerson' },
                        loanReleaseAmount: { $sum: '$data.loanReleaseAmount' },
                        activeLoanReleasePerson: { $sum: '$data.activeLoanReleasePerson' },
                        activeLoanReleaseAmount: { $sum: '$data.activeLoanReleaseAmount' },
                        collectionTarget: { $sum: '$data.collectionTarget' },
                        collectionAdvancePayment: { $sum: '$data.collectionAdvancePayment' },
                        collectionActual: { $sum: '$data.collectionActual' },
                        pastDuePerson: { $sum: '$data.pastDuePerson' },
                        pastDueAmount: { $sum: '$data.pastDueAmount' },
                        fullPaymentPerson: { $sum: '$data.fullPaymentPerson' },
                        fullPaymentAmount: { $sum: '$data.fullPaymentAmount' },
                        activeBorrowers: { $sum: '$data.activeBorrowers' },
                        loanBalance: { $sum: '$data.loanBalance' }
                    }
                }
            ]).toArray();
        } else if (user[0].role.rep === 4) {
            fBalance = await db.collection('losTotals').find({ userId: userId, month: lastMonth, year: lastYear, losType: 'commulative', occurence: occurence }).toArray();
            summary = await db.collection('losTotals').find({ userId: userId, month: currentMonth, year: currentYear, losType: 'daily', occurence: occurence }).toArray();
        }
        
        data = {
            fBalance: fBalance.length > 0 ? fBalance : [],
            current: summary
        }
    }
        
    response = { success: true, data: data };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}