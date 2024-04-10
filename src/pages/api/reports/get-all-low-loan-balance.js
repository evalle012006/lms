import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const { loId, currentUserId, branchId, amountOption, noOfPaymentsOption } = req.query;
    let data = [];
    const amountOptionObj = JSON.parse(amountOption);
    const noOfPaymentsOptionObj = JSON.parse(noOfPaymentsOption);

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
                                            if: { $eq: [amountOptionObj.operator, 'less_than_equal'] },
                                            then: {$lte: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [amountOptionObj.operator, 'greater_than_equal'] },
                                            then: {$gte: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [amountOptionObj.operator, 'equal'] },
                                            then: {$eq: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                            else: null
                                        }}
                                    ] },
                                    { $or: [
                                        {$cond: {
                                            if: { $eq: [noOfPaymentsOptionObj.operator, 'less_than_equal'] },
                                            then: {$lte: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [noOfPaymentsOptionObj.operator, 'greater_than_equal'] },
                                            then: {$gte: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [noOfPaymentsOptionObj.operator, 'equal'] },
                                            then: {$eq: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                            else: null
                                        }}
                                    ] }
                                ] 
                            } } },
                            { $project: {
                                clientId: '$clientId',
                                slotNo: '$slotNo',
                                loanBalance: '$loanBalance',
                                amountRelease: '$amountRelease',
                                loanCycle: '$loanCycle',
                                mcbu: '$mcbu',
                                noOfMisPayments: '$mispayment',
                                noOfPayments: '$noOfPayments'
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
                                                firstName: '$firstName',
                                                lastName: '$lastName',
                                                fullName: '$fullName',
                                                delinquent: '$delinquent'
                                            }
                                        }
                                    ],
                                    as: 'client'
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
                                            if: { $eq: [amountOptionObj.operator, 'less_than_equal'] },
                                            then: {$lte: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [amountOptionObj.operator, 'greater_than_equal'] },
                                            then: {$gte: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [amountOptionObj.operator, 'equal'] },
                                            then: {$eq: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                            else: null
                                        }}
                                    ] },
                                    { $or: [
                                        {$cond: {
                                            if: { $eq: [noOfPaymentsOptionObj.operator, 'less_than_equal'] },
                                            then: {$lte: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [noOfPaymentsOptionObj.operator, 'greater_than_equal'] },
                                            then: {$gte: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                            else: null
                                        }},
                                        {$cond: {
                                            if: { $eq: [noOfPaymentsOptionObj.operator, 'equal'] },
                                            then: {$eq: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
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
        if (currentUserId) {
            const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
            if (user.length > 0) {
                if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                    const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                    branchIdsObj = branches.map(branch => branch._id.toString());
                } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                    const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                    branchIdsObj = branches.map(branch => branch._id.toString());
                } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                    const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                    branchIdsObj = branches.map(branch => branch._id.toString());
                }
            }
        } else {
            const branches = await db.collection('branches').find({}).toArray();
            branchIdsObj = branches.map(branch => branch._id + '');
        }
        
        const branchData = [];
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(branchIdsObj.map(async (branchId) => {
                branchData.push.apply(branchData, await getByBranch(db, branchId, amountOptionObj, noOfPaymentsOptionObj));
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


const getByBranch = async (db, branchId, amountOptionObj, noOfPaymentsOptionObj) => {
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
                                        if: { $eq: [amountOptionObj.operator, 'less_than_equal'] },
                                        then: {$lte: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                        else: null
                                    }},
                                    {$cond: {
                                        if: { $eq: [amountOptionObj.operator, 'greater_than_equal'] },
                                        then: {$gte: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                        else: null
                                    }},
                                    {$cond: {
                                        if: { $eq: [amountOptionObj.operator, 'equal'] },
                                        then: {$eq: ['$loanBalance', parseInt(amountOptionObj.amount)]},
                                        else: null
                                    }}
                                ] },
                                { $or: [
                                    {$cond: {
                                        if: { $eq: [noOfPaymentsOptionObj.operator, 'less_than_equal'] },
                                        then: {$lte: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                        else: null
                                    }},
                                    {$cond: {
                                        if: { $eq: [noOfPaymentsOptionObj.operator, 'greater_than_equal'] },
                                        then: {$gte: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                        else: null
                                    }},
                                    {$cond: {
                                        if: { $eq: [noOfPaymentsOptionObj.operator, 'equal'] },
                                        then: {$eq: ['$noOfPayments', parseInt(noOfPaymentsOptionObj.noOfPayments)]},
                                        else: null
                                    }}
                                ] }
                            ] 
                        } } },
                        { $group: {
                            _id: '$branchId',
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