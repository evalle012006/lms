import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { date, userId, branchId } = req.query;
    let statusCode = 200;
    let response = {};
    let data;

    const user = await db.collection('users').find({ _id: ObjectId(userId) }).toArray();

    if (user.length > 0) {
        const startOfMonth = moment(date).startOf('month').format('YYYY-MM-DD');
        const endOfMonth = moment(date).endOf('month').format('YYYY-MM-DD');

        const lastMonth = moment(date).subtract(1, 'months').month() + 1;
        const lastYear = lastMonth === 12 ? moment(date).subtract(1, 'years').year() : moment(date).year();

        const fBalance = await db.collection('losTotals').find({ userId: userId, month: lastMonth, year: lastYear }).toArray();
        
        let summary;

        if (user[0].role.rep === 3) {
            // search for branch info here...
        } else if (user[0].role.rep === 4) {
            summary = await db.collection('cashCollections')
                .aggregate([
                    { $match: { loId: userId, dateAdded: { $gte: startOfMonth, $lte: endOfMonth } } }, //{$sort: {dateAdded: 1}}
                    // consider the group summary collection status it needs to be close 
                        // how to add the group summary collection? query it first per day? this is for BM only
                    {
                        $group: {
                            _id: '$dateAdded',
                            transfer: { $sum: 0 }, // not yet implemented
                            newMember: { $sum: { // tomorrow only and loanCycle 1
                                $cond: {
                                    if: { $and: [{$eq: ['$status', 'tomorrow']}, {$eq: ['$loanCycle', 1]}, {$ne: ['$status', 'pending']}] },
                                    then: 1,
                                    else: 0
                                }
                            } },
                            offsetPerson: { $sum: {
                                $cond: {
                                    if: { $eq: ['$remarks.value', 'offset'] },
                                    then: 1,
                                    else: 0
                                }
                            } },
                            activeClients: { $sum: {
                                $cond: {
                                    if: { $and: [{$ne: ['$status', 'closed']}, {$ne: ['$status', 'pending']}] },
                                    then: 1,
                                    else: 0
                                }
                            }},
                            loanReleasePerson: { $sum: {
                                $cond: {
                                    if: { $eq: ['$status', 'tomorrow'] },
                                    then: 1,
                                    else: 0
                                }
                            } },
                            loanReleaseAmount: { $sum: {
                                $cond: {
                                    if: { $eq: ['$status', 'tomorrow'] },
                                    then: '$currentReleaseAmount',
                                    else: 0
                                }
                            } },
                            collectionTarget: { $sum: {
                                    $cond: {
                                        if: { $or: [{$eq: ['$remarks.value', 'delinquent']}, {$eq: ['$remarks.value', 'past due']}, {$eq: ['$remarks.value', 'excused']}] },
                                        then: 0,
                                        else: '$activeLoan'
                                    }
                                }
                            },
                            collectionAdvancePayment: { $sum: '$excess' },
                            collectionActual: { $sum: '$paymentCollection' },
                            pastDuePerson: { $sum: {
                                $cond: {
                                    if: { $eq: ['$remarks.value', 'past due'] },
                                    then: 1,
                                    else: 0
                                }
                            } },
                            pastDueAmount: { $sum: {
                                $cond: {
                                    if: { $eq: ['$remarks.value', 'past due'] },
                                    then: '$pastDue',
                                    else: 0
                                }
                            } },
                            fullPaymentPerson: { $sum: {
                                $cond: {
                                    if: { $gt: ['$fullPayment', 0] },
                                    then: 1,
                                    else: 0
                                }
                            } },
                            fullPaymentAmount: { $sum: {
                                $cond: {
                                    if: { $gt: ['$fullPayment', 0] },
                                    then: '$fullPayment',
                                    else: 0
                                }
                            } },
                            activeBorrowers: { $sum: { // activeClients + loanBalance > 0 + (fullpayment remarks not PENDING)
                                $cond: {
                                    if: { $and: [{$ne: ['$status', 'closed']}, {$ne: ['$status', 'pending']}, {$gt: ['$loanBalance', 0]}, {$ne: ['$remarks.value', 'pending']}] },
                                    then: 1,
                                    else: 0
                                } 
                            } },
                            loanBalance: { $sum: { $cond:{
                                if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'tomorrow']}] }, 
                                then: '$loanBalance',
                                else: 0
                            } } }
                        }
                    },
                    { $sort: { _id: 1 } }
                ])
                .toArray();
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