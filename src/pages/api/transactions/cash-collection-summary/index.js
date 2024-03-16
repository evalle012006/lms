import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { date, userId, branchId, loId, filter, loGroup } = req.query;
    let statusCode = 200;
    let response = {};
    let data;

    const user = await db.collection('users').find({ _id: new ObjectId(userId) }).toArray();

    if (user.length > 0) {
        const currentMonth = moment(date).month() + 1;
        const currentYear = moment(date).year();

        const lastMonth = moment(date).subtract(1, 'months').month() + 1;
        const lastYear = lastMonth === 12 ? moment(date).subtract(1, 'years').year() : moment(date).year();

        const userId = user[0]._id + '';

        let fBalance = [];
        let fBalanceMigration = [];
        let summary = [];

        if (user[0].role.rep === 3) {
            await getFBalanceMigration(branchId, lastMonth, lastYear, userId, loGroup);
            fBalance = await db.collection('losTotals').find({ userId: userId, month: lastMonth, year: lastYear, losType: 'commulative', officeType: loGroup }).toArray();
            summary = await db.collection('losTotals').aggregate([
                { $match: { 
                    $expr: {
                        $and: [
                            { $eq: ['$branchId', branchId] },
                            { $eq: ['$month', currentMonth] },
                            { $eq: ['$year', currentYear] },
                            { $eq: ['$losType', 'daily'] },
                            { $eq: ['$userType', 'lo'] },
                            { $or: [
                                { $cond: {
                                    if: {$eq: [loGroup, 'all']},
                                    then: { $or: [{ $eq: ['$officeType', 'main'] }, { $eq: ['$officeType', 'ext'] }] },
                                    else: null
                                } },
                                { $cond: {
                                    if: {$eq: [loGroup, 'main']},
                                    then: { $eq: ['$officeType', 'main'] },
                                    else: null
                                } },
                                { $cond: {
                                    if: {$eq: [loGroup, 'ext']},
                                    then: { $eq: ['$officeType', 'ext'] },
                                    else: null
                                } }
                            ] }
                        ]
                    }
                } },
                { $sort: { dateAdded: 1 } },
                {
                    $group: {
                        _id: {branchId: '$branchId', dateAdded: '$dateAdded'},
                        transfer: { $sum: '$data.transfer' },
                        newMember: { $sum: '$data.newMember' },
                        prevMcbuBalance: { $sum: "$data.prevMcbuBalance" },
                        mcbuTarget: { $sum: { $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.mcbuTarget',
                            else: 0
                        } } },
                        transferMcbu: { $sum: '$data.transferMcbu' },
                        mcbuActual: { $sum: '$data.mcbuActual' },
                        mcbuWithdrawal: { $sum: '$data.mcbuWithdrawal' },
                        mcbuInterest: { $sum: '$data.mcbuInterest' },
                        noMcbuReturn: { $sum: '$data.noMcbuReturn' },
                        mcbuReturnAmt: { $sum: '$data.mcbuReturnAmt' },
                        mcbuBalance: { $sum: '$data.mcbuBalance' },
                        offsetPerson: { $sum: '$data.offsetPerson' },
                        activeClients: { $sum: '$data.activeClients' },
                        loanReleaseDailyPerson: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'daily'] },
                                then: '$data.loanReleasePerson',
                                else: 0
                            }
                        } },
                        loanReleaseDailyAmount: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'daily'] },
                                then: '$data.loanReleaseAmount',
                                else: 0
                            }
                        } },
                        loanReleaseWeeklyPerson: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'weekly'] },
                                then: '$data.loanReleasePerson',
                                else: 0
                            }
                        } },
                        loanReleaseWeeklyAmount: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'weekly'] },
                                then: '$data.loanReleaseAmount',
                                else: 0
                            }
                        } },
                        consolidatedLoanReleasePerson: { $sum: '$data.loanReleasePerson' },
                        consolidatedLoanReleaseAmount: { $sum: '$data.loanReleaseAmount' },
                        activeLoanReleasePerson: { $sum: '$data.activeLoanReleasePerson' },
                        activeLoanReleaseAmount: { $sum: '$data.activeLoanReleaseAmount' },
                        collectionTargetDaily: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'daily'] },
                                then: '$data.collectionTarget',
                                else: 0
                            }
                        } },
                        collectionAdvancePaymentDaily: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'daily'] },
                                then: '$data.collectionAdvancePayment',
                                else: 0
                            }
                        } },
                        collectionActualDaily: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'daily'] },
                                then: '$data.collectionActual',
                                else: 0
                            }
                        } },
                        collectionTargetWeekly: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'weekly'] },
                                then: '$data.collectionTarget',
                                else: 0
                            }
                        } },
                        collectionAdvancePaymentWeekly: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'weekly'] },
                                then: '$data.collectionAdvancePayment',
                                else: 0
                            }
                        } },
                        collectionActualWeekly: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'weekly'] },
                                then: '$data.collectionActual',
                                else: 0
                            }
                        } },
                        consolidatedCollection: { $sum: '$data.collectionActual' },
                        pastDuePerson: { $sum: '$data.pastDuePerson' },
                        pastDueAmount: { $sum: '$data.pastDueAmount' },
                        mispaymentPerson: { $sum: '$data.mispaymentPerson' },
                        fullPaymentDailyPerson: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'daily'] },
                                then: '$data.fullPaymentPerson',
                                else: 0
                            }
                        } },
                        fullPaymentDailyAmount: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'daily'] },
                                then: '$data.fullPaymentAmount',
                                else: 0
                            }
                        } },
                        fullPaymentWeeklyPerson: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'weekly'] },
                                then: '$data.fullPaymentPerson',
                                else: 0
                            }
                        } },
                        fullPaymentWeeklyAmount: { $sum: {
                            $cond: {
                                if: { $eq: ['$occurence', 'weekly'] },
                                then: '$data.fullPaymentAmount',
                                else: 0
                            }
                        } },
                        consolidatedFullPaymentPerson: { $sum: '$data.fullPaymentPerson' },
                        consolidatedFullPaymentAmount: { $sum: '$data.fullPaymentAmount' },
                        activeBorrowers: { $sum: '$data.activeBorrowers' },
                        loanBalance: { $sum: '$data.loanBalance' },
                        transferDailyGvr: { $addToSet: { $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.transferGvr',
                            else: null
                        } } },
                        transferDailyRcv: { $addToSet: { $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.transferRcv',
                            else: null
                        } } },
                        transferWeeklyGvr: { $addToSet: { $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.transferGvr',
                            else: null
                        } } },
                        transferWeeklyRcv: { $addToSet: { $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.transferRcv',
                            else: null
                        } } },
                    }
                }
            ]).toArray();
        } else if (user[0].role.rep === 4) {
            fBalance = await db.collection('losTotals').find({ userId: userId, month: lastMonth, year: lastYear, losType: 'commulative' }).toArray();
            summary = await db.collection('losTotals').find({ userId: userId, month: currentMonth, year: currentYear, losType: 'daily' }).toArray();
        }
        
        data = {
            fBalance: fBalance.length > 0 ? fBalance : [],
            fBalanceMigration: fBalanceMigration,
            current: summary
        }
    }
        
    response = { success: true, data: data };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const getFBalanceMigration = async (branchId, lastMonth, lastYear, userId, loGroup) => {
    const { db } = await connectToDatabase();
    const existingMigratedFBalance = await db.collection('losTotals').find({ userId: userId, month: lastMonth, year: lastYear, losType: "commulative", insertedBy: "migration", officeType: loGroup }).toArray();
    if (existingMigratedFBalance.length === 0) {
        const migratedFBalance = await db.collection('losTotals').aggregate([
            { $match: { 
                $expr: {
                    $and: [
                        { $eq: ['$branchId', branchId] },
                        { $eq: ['$month', currentMonth] },
                        { $eq: ['$year', currentYear] },
                        { $eq: ['$losType', 'commulative'] },
                        { $eq: ['$insertedBy', 'migration'] },
                        { $or: [
                            { $cond: {
                                if: {$eq: [loGroup, 'all']},
                                then: { $or: [{ $eq: ['$officeType', 'main'] }, { $eq: ['$officeType', 'ext'] }] },
                                else: null
                            } },
                            { $cond: {
                                if: {$eq: [loGroup, 'main']},
                                then: { $eq: ['$officeType', 'main'] },
                                else: null
                            } },
                            { $cond: {
                                if: {$eq: [loGroup, 'ext']},
                                then: { $eq: ['$officeType', 'ext'] },
                                else: null
                            } }
                        ] }
                    ]
                }
            } },
            { $sort: { dateAdded: 1 } },
            {
                $group: {
                    _id: {branchId: '$branchId', dateAdded: '$dateAdded'},
                    transfer: { $sum: '$data.transfer' },
                    newMember: { $sum: '$data.newMember' },
                    prevMcbuBalance: { $sum: "$data.prevMcbuBalance" },
                    mcbuTarget: { $sum: { $cond: {
                        if: { $eq: ['$occurence', 'weekly'] },
                        then: '$data.mcbuTarget',
                        else: 0
                    } } },
                    transferMcbu: { $sum: '$data.transferMcbu' },
                    mcbuActual: { $sum: '$data.mcbuActual' },
                    mcbuWithdrawal: { $sum: '$data.mcbuWithdrawal' },
                    mcbuInterest: { $sum: '$data.mcbuInterest' },
                    noMcbuReturn: { $sum: '$data.noMcbuReturn' },
                    mcbuReturnAmt: { $sum: '$data.mcbuReturnAmt' },
                    mcbuBalance: { $sum: '$data.mcbuBalance' },
                    offsetPerson: { $sum: '$data.offsetPerson' },
                    activeClients: { $sum: '$data.activeClients' },
                    loanReleaseDailyPerson: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.loanReleasePerson',
                            else: 0
                        }
                    } },
                    loanReleaseDailyAmount: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.loanReleaseAmount',
                            else: 0
                        }
                    } },
                    loanReleaseWeeklyPerson: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.loanReleasePerson',
                            else: 0
                        }
                    } },
                    loanReleaseWeeklyAmount: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.loanReleaseAmount',
                            else: 0
                        }
                    } },
                    consolidatedLoanReleasePerson: { $sum: '$data.loanReleasePerson' },
                    consolidatedLoanReleaseAmount: { $sum: '$data.loanReleaseAmount' },
                    activeLoanReleasePerson: { $sum: '$data.activeLoanReleasePerson' },
                    activeLoanReleaseAmount: { $sum: '$data.activeLoanReleaseAmount' },
                    collectionTargetDaily: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.collectionTarget',
                            else: 0
                        }
                    } },
                    collectionAdvancePaymentDaily: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.collectionAdvancePayment',
                            else: 0
                        }
                    } },
                    collectionActualDaily: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.collectionActual',
                            else: 0
                        }
                    } },
                    collectionTargetWeekly: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.collectionTarget',
                            else: 0
                        }
                    } },
                    collectionAdvancePaymentWeekly: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.collectionAdvancePayment',
                            else: 0
                        }
                    } },
                    collectionActualWeekly: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.collectionActual',
                            else: 0
                        }
                    } },
                    consolidatedCollection: { $sum: '$data.collectionActual' },
                    pastDuePerson: { $sum: '$data.pastDuePerson' },
                    pastDueAmount: { $sum: '$data.pastDueAmount' },
                    mispaymentPerson: { $sum: '$data.mispaymentPerson' },
                    fullPaymentDailyPerson: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.fullPaymentPerson',
                            else: 0
                        }
                    } },
                    fullPaymentDailyAmount: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'daily'] },
                            then: '$data.fullPaymentAmount',
                            else: 0
                        }
                    } },
                    fullPaymentWeeklyPerson: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.fullPaymentPerson',
                            else: 0
                        }
                    } },
                    fullPaymentWeeklyAmount: { $sum: {
                        $cond: {
                            if: { $eq: ['$occurence', 'weekly'] },
                            then: '$data.fullPaymentAmount',
                            else: 0
                        }
                    } },
                    consolidatedFullPaymentPerson: { $sum: '$data.fullPaymentPerson' },
                    consolidatedFullPaymentAmount: { $sum: '$data.fullPaymentAmount' },
                    activeBorrowers: { $sum: '$data.activeBorrowers' },
                    loanBalance: { $sum: '$data.loanBalance' }
                }
            }
        ]).toArray();
        // console.log(migratedFBalance)
        if (migratedFBalance.length > 0) {
            const monthStr = lastMonth < 10 ? "0" + lastMonth : lastMonth;
            const dateAdded = lastYear + "-" + monthStr + "-30";
            let temp = {...migratedFBalance[0]};
    
            temp.day = "Commulative";
            temp.grandTotal = true;
    
            const bmsFwBalance = {
                userId: userId,
                month: lastMonth,
                year: lastYear,
                data: temp,
                losType: "commulative",
                insertedBy: "migration",
                insertedDateTime: new Date(),
                dateAdded: dateAdded,
                officeType: loGroup
            }
    
            // if (existingMigratedFBalance.length > 0) {
            //     console.log('updating BMS fwbalance...')
            //     await db.collection('losTotals').updateOne({ _id: existingMigratedFBalance[0]._id }, { $set: {...bmsFwBalance} });
            // } else {
                await db.collection('losTotals').insertOne({...bmsFwBalance});
            // }
        }
    }
}