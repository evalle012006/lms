import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    const { db } = await connectToDatabase();
    let response;
    let statusCode = 200;

    const { loId, branchIds, branchId, amount, operator } = req.query;
    let data = [];

    if (loId) {
        data = await db.collection('groups')
            .aggregate([
                { $match: { loanOfficerId: loId, noOfClients: { $ne: 0 } } },
                { $addFields: {
                    groupIdStr: { $toString: '$_id' }
                } },
                {
                    $lookup: {
                        from: 'loans',
                        localField: 'groupIdStr',
                        foreignField: 'groupId',
                        pipeline: [
                            { $match: { $expr: { 
                                $and: [ 
                                    {$eq: ['$status', 'active']},
                                    { $or: [
                                        {$cond: {
                                            if: { $eq: [operator, 'less_than_equal'] },
                                            then: {$lte: ['$loanBalance', parseInt(amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [operator, 'greater_than_equal'] },
                                            then: {$gte: ['$loanBalance', parseInt(amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [operator, 'equal'] },
                                            then: {$eq: ['$loanBalance', parseInt(amount)]},
                                            else: null
                                        }}
                                    ] }
                                ] 
                            } } },
                            { $project: {
                                clientId: '$clientId',
                                clientName: '$fullName',
                                slotNo: '$slotNo',
                                loanBalance: '$loanBalance',
                                amountRelease: '$amountRelease',
                                loanCycle: '$loanCycle',
                                mcbu: '$mcbu',
                                noOfMisPayments: '$mispayment'
                            } },
                            {
                                $addFields: {
                                    clientIdObj: { $toObjectId: '$clientId' }
                                }
                            },
                            {
                                $lookup: {
                                    from: 'client',
                                    localField: 'clientIdObj',
                                    foreignField: '_id',
                                    pipeline: [
                                        {
                                            $project: {
                                                delinquent: '$delinquent'
                                            }
                                        }
                                    ],
                                    as: 'clientStatus'
                                }
                            }
                        ],
                        as: 'loans'
                    }
                },
                {
                    $project: {
                        name: '$name',
                        branchId: '$branchId',
                        loans: '$loans'
                    }
                }
            ]).toArray();
    }  else if (branchId) {
        data = await db.collection('users')
            .aggregate([
                { $match: { "role.rep": 4, designatedBranchId: branchId } },
                { $addFields: {
                    loId: { $toString: '$_id' },
                } },
                {
                    $lookup: {
                        from: 'loans',
                        localField: 'loId',
                        foreignField: 'loId',
                        pipeline: [
                            { $match: { $expr: { 
                                $and: [ 
                                    {$eq: ['$status', 'active']},
                                    { $or: [
                                        {$cond: {
                                            if: { $eq: [operator, 'less_than_equal'] },
                                            then: {$lte: ['$loanBalance', parseInt(amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [operator, 'greater_than_equal'] },
                                            then: {$gte: ['$loanBalance', parseInt(amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [operator, 'equal'] },
                                            then: {$eq: ['$loanBalance', parseInt(amount)]},
                                            else: null
                                        }}
                                    ] }
                                ] 
                            } } },
                            { $group: {
                                _id: '$loId',
                                totalClients: { $sum: 1 },
                                totalAmountRelease: { $sum: '$amountRelease' },
                                totalLoanBalance: { $sum: '$loanBalance' },
                                totalMCBU: { $sum: '$mcbu' }
                            } }
                        ],
                        as: 'loans'
                    }
                },
                {
                    $project: {
                        firstName: '$firstName',
                        lastName: '$lastName',
                        branchId: '$designatedBranchId',
                        loans: '$loans',
                        loNo: '$loNo'
                    }
                },
                {
                    $sort: { loNo: 1 }
                }
            ]).toArray();
    } else {
        let branchIdsObj;
        if (branchIds) {
            branchIdsObj = JSON.parse(branchIds);
        } else {
            const branches = await db.collection('branches').find({}).toArray();
            branchIdsObj = branches.map(branch => branch._id + '');
        }
        
        const branchData = [];
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(branchIdsObj.map(async (branchId) => {
                branchData.push.apply(branchData, await getByBranch(db, branchId, amount, operator));
            }));

            resolve(response);
        });

        if (promise) {
            data = branchData;
        }
    }

    response = { success: true, data: data };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


const getByBranch = async (db, branchId, amount, operator) => {
    const ObjectId = require('mongodb').ObjectId;

    return await db.collection('branches')
        .aggregate([
            { $match: { _id: new ObjectId(branchId) } },
            { $addFields: {
                branchIdStr: { $toString: '$_id' },
            } },
            {
                $lookup: {
                    from: 'loans',
                    localField: 'branchIdStr',
                    foreignField: 'branchId',
                    pipeline: [
                        { $match: { $expr: { 
                            $and: [ 
                                {$eq: ['$status', 'active']},
                                { $or: [
                                    {$cond: {
                                        if: { $eq: [operator, 'less_than_equal'] },
                                        then: {$lte: ['$loanBalance', parseInt(amount)]},
                                        else: null
                                    }},
                                    {$cond: {
                                        if: { $eq: [operator, 'greater_than_equal'] },
                                        then: {$gte: ['$loanBalance', parseInt(amount)]},
                                        else: null
                                    }},
                                    {$cond: {
                                        if: { $eq: [operator, 'equal'] },
                                        then: {$eq: ['$loanBalance', parseInt(amount)]},
                                        else: null
                                    }}
                                ] }
                            ] 
                        } } },
                        { $group: {
                            _id: '$branchid',
                            totalClients: { $sum: 1 },
                            totalAmountRelease: { $sum: '$amountRelease' },
                            totalLoanBalance: { $sum: '$loanBalance' },
                            totalMCBU: { $sum: '$mcbu' }
                        } }
                    ],
                    as: 'loans'
                }
            },
            {
                $project: {
                    name: '$name',
                    code: '$code',
                    loans: '$loans'
                }
            }
        ])
        .toArray();
}