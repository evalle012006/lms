import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { date, loId, branchId, branchCodes } = req.query;
    let statusCode = 200;
    let response = {};

    const startOfMonth = moment(date ? new Date(date) : new Date()).startOf('month').format('YYYY-MM-DD');
    const endOfMonth = moment(date ? new Date(date) : new Date()).endOf('month').format('YYYY-MM-DD');

    let summary;

    if (loId) {
        summary = await db.collection('cashCollections')
            .aggregate([
                { $match: { loId: loId, dateAdded: { $gte: startOfMonth, $lte: endOfMonth } } }, //{$sort: {dateAdded: 1}}
                // group by: group and date (per day)
                // consider the group summary collection status it needs to be close 
                    // how to add the group summary collection? query it first per day? this is for BM only
                {
                    $group: {
                        _id: '$dateAdded',
                        // {
                        //     groupId: '$groupId',
                        //     groupName: '$groupName',
                        //     dateAdded: '$dateAdded'
                        // },
                        transfer: { $sum: 0 }, // not yet implemented
                        newMember: { $sum: {
                            $cond: {
                                if: { $eq: ['$loanCycle', 1] },
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
                        activeClients: { $sum: 1 },
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
                                if: { $eq: ['$status', 'active'] },
                                then: '$activeLoan',
                                else: 0
                            }
                        } },
                        collectionAdvancePayment: { $sum: {
                            $cond: {
                                if: { $eq: ['$status', 'active'] },
                                then: '$excess',
                                else: 0
                            }
                        } },
                        collectionActual: { $sum: {
                            $cond: {
                                if: { $eq: ['$status', 'active'] },
                                then: '$paymentCollection',
                                else: 0
                            }
                        } },
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
                        activeBorrowers: { $sum: {
                            $cond: {
                                if: { $gt: ['$loanBalance', 0] },
                                then: 1,
                                else: 0
                            } 
                        } },
                        loanBalance: { $sum: { $cond:{
                            if: { $and: [{$ne: ['$status', 'pending']}, {$ne: ['$status', 'tomorrow']}] }, 
                            then: {
                                $cond: {
                                    if: { $eq: ['$dateAdded', '$fullPaymentDate'] },
                                    then: '$history.loanBalance',
                                    else: '$loanBalance'
                                }
                            },
                            else: 0
                        } } }
                    }
                },
                { $sort: { _id: 1 } }
            ])
            .toArray();
    }
        
    response = { success: true, data: summary };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}