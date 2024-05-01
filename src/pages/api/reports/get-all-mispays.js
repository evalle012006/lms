import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { formatPricePhp } from '@/lib/utils';

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const { loId, currentUserId, branchId, date, remarks } = req.query;
    let data = [];

    if (loId) {
        const groupData = await db.collection('groups')
            .aggregate([
                { $match: { loanOfficerId: loId, noOfClients: { $ne: 0 } } },
                { $addFields: {
                    groupIdStr: { $toString: '$_id' }
                } },
                {
                    $lookup: {
                        from: 'cashCollections',
                        localField: 'groupIdStr',
                        foreignField: 'groupId',
                        pipeline: [
                            { $match: { $expr: { 
                                $and: [ 
                                    {$eq: ['$dateAdded', date]},
                                    {$ne: ['$transfer', true]},
                                    { $or: [
                                        {$cond: {
                                            if: { $eq: [remarks, 'all'] },
                                            then: {
                                                $or: [
                                                    {$eq: ['$remarks.value', 'past due'] },
                                                    {$eq: ['$remarks.value', 'matured-past due'] },
                                                    {$eq: ['$remarks.value', 'delinquent'] },
                                                    {$eq: ['$remarks.value', 'delinquent-mcbu'] },
                                                    {$regexMatch: { input: '$remarks.value', regex: /^excused-/ }}
                                                ]
                                            },
                                            else: {$eq: ['$remarks.value', remarks]}
                                        }}
                                    ] }
                                ] 
                            } } },
                            { $project: {
                                clientId: '$clientId',
                                slotNo: '$slotNo',
                                netLoanBalance: { $subtract: ['$loanBalance', '$mcbu'] },
                                loanBalance: '$loanBalance',
                                amountRelease: '$amountRelease',
                                loanCycle: '$loanCycle',
                                mcbu: '$mcbu',
                                noOfPayments: '$noOfPayments',
                                remarks: '$remarks.label'
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

            if (groupData) {
                let totalClients = 0;
                let totalAmountRelease = 0;
                let totalLoanBalance = 0;
                let totalMCBU = 0;
                let totalNetLoanBalance = 0;

                groupData.map(group => {
                    group.loans.map(loan => {
                        const delinquent = loan.client.length > 0 ? loan.client[0].delinquent == true ? 'Yes' : 'No' : 'No';
                        let fullName = loan.client.length > 0 ? loan.client[0].fullName : null;
                        if (loan.client.length > 0 && fullName == null) {
                            fullName = `${loan.client[0].lastName}, ${loan.client[0].firstName}`;
                        }
                        data.push({
                            groupId: group._id,
                            groupName: group.name,
                            slotNo: loan.slotNo,
                            clientName: fullName,
                            loanCycle: loan.loanCycle,
                            amountRelease: loan.amountRelease,
                            amountReleaseStr: formatPricePhp(loan.amountRelease),
                            loanBalance: loan.loanBalance,
                            loanBalanceStr: formatPricePhp(loan.loanBalance),
                            mcbu: loan.mcbu,
                            mcbuStr: formatPricePhp(loan.mcbu),
                            netLoanBalance: loan.netLoanBalance,
                            netLoanBalanceStr: formatPricePhp(loan.netLoanBalance),
                            noOfPayments: loan.noOfPayments,
                            delinquent: delinquent,
                            remarks: loan.remarks
                        });
    
                        totalClients += 1;
                        totalAmountRelease += loan.amountRelease;
                        totalLoanBalance += loan.loanBalance;
                        totalMCBU += loan.mcbu;
                        totalNetLoanBalance += loan.netLoanBalance;
                    });
                });

                data.sort((a, b) => { return a.loanBalance - b.loanBalance });

                data.push({
                    groupId: "TOTALS",
                    groupName: "TOTALS",
                    slotNo: '-',
                    clientName: totalClients,
                    loanCycle: '-',
                    amountReleaseStr: formatPricePhp(totalAmountRelease),
                    loanBalanceStr: formatPricePhp(totalLoanBalance),
                    mcbuStr: formatPricePhp(totalMCBU),
                    netLoanBalanceStr: formatPricePhp(totalNetLoanBalance),
                    noOfPayments: '-',
                    delinquent: '-',
                    remarks: '-',
                    totalData: true
                });
            }
    }  else if (branchId) {
        const loData = await db.collection('users')
            .aggregate([
                { $match: { "role.rep": 4, designatedBranchId: branchId } },
                { $addFields: {
                    loId: { $toString: '$_id' },
                } },
                {
                    $lookup: {
                        from: 'cashCollections',
                        localField: 'loId',
                        foreignField: 'loId',
                        pipeline: [
                            { $match: { $expr: { 
                                $and: [ 
                                    {$eq: ['$dateAdded', date]},
                                    {$ne: ['$transfer', true]},
                                    { $or: [
                                        {$cond: {
                                            if: { $eq: [remarks, 'all'] },
                                            then: {
                                                $or: [
                                                    {$eq: ['$remarks.value', 'past due'] },
                                                    {$eq: ['$remarks.value', 'matured-past due'] },
                                                    {$eq: ['$remarks.value', 'delinquent'] },
                                                    {$eq: ['$remarks.value', 'delinquent-mcbu'] },
                                                    {$regexMatch: { input: '$remarks.value', regex: /^excused-/ }}
                                                ]
                                            },
                                            else: {$eq: ['$remarks.value', remarks]}
                                        }}
                                    ] }
                                ] 
                            } } },
                            { $addFields: { 
                                loanBalanceInt: {$convert: {input: '$loanBalance', to : 'int', onError: 0, onNull: 0}}, 
                                mcbuInt: {$convert: {input: '$mcbu', to : 'int', onError: 0, onNull: 0}}
                            } },
                            { $group: {
                                _id: '$loId',
                                totalMispayments: { $sum: { $cond: {
                                    if: { $eq: ['$mispayment', true] },
                                    then: 1,
                                    else: 0
                                } } },
                                totalAmountRelease: { $sum: '$amountRelease' },
                                totalLoanBalance: { $sum: '$loanBalance' },
                                totalMCBU: { $sum: '$mcbu' },
                                totalNetLoanBalance: { $sum: { $subtract: ['$loanBalanceInt', '$mcbuInt'] } },
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

        if (loData) {
            let totalMispays = 0;
            let totalAmountRelease = 0;
            let totalLoanBalance = 0;
            let totalMCBU = 0;
            let totalNetLoanBalance = 0;

            loData.map(lo => {
                let temp = {
                    _id: lo._id,
                    loName: `${lo.firstName} ${lo.lastName}`
                }
                lo.loans.map(loan => {
                    temp = {
                        ...temp,
                        noOfMispays: loan.totalMispayments,
                        totalAmountRelease: loan.totalAmountRelease,
                        totalAmountReleaseStr: formatPricePhp(loan.totalAmountRelease),
                        totalLoanBalance: loan.totalLoanBalance,
                        totalLoanBalanceStr: formatPricePhp(loan.totalLoanBalance),
                        totalMCBU: loan.totalMCBU,
                        totalMCBUStr: formatPricePhp(loan.totalMCBU),
                        totalNet: loan.totalNetLoanBalance,
                        totalNetStr: formatPricePhp(loan.totalNetLoanBalance)
                    };

                    totalMispays += loan.totalMispayments;
                    totalAmountRelease += loan.totalAmountRelease;
                    totalLoanBalance += loan.totalLoanBalance;
                    totalMCBU += loan.totalMCBU;
                    totalNetLoanBalance += loan.totalNetLoanBalance;
                });

                data.push(temp);
            });

            data.sort((a, b) => { return a.loanBalance - b.loanBalance });

            data = data.filter(lo => lo.noOfMispays > 0);

            data.push({
                _id: 'TOTALS',
                loName: 'TOTALS',
                noOfMispays: totalMispays,
                totalAmountReleaseStr: formatPricePhp(totalAmountRelease),
                totalLoanBalanceStr: formatPricePhp(totalLoanBalance),
                totalMCBUStr: formatPricePhp(totalMCBU),
                totalNetStr: formatPricePhp(totalNetLoanBalance),
                totalData: true
            });
        }
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
                branchData.push.apply(branchData, await getByBranch(db, branchId, remarks, date));
            }));

            resolve(response);
        });

        if (promise) {
            let totalMispays = 0;
            let totalAmountRelease = 0;
            let totalLoanBalance = 0;
            let totalMCBU = 0;
            let totalNetLoanBalance = 0;

            branchData.map(branch => {
                let temp = {
                    _id: branch._id,
                    code: branch.code,
                    name: branch.name,
                    noOfMispays: 0,
                    totalAmountRelease: 0,
                    totalAmountReleaseStr: '-',
                    totalLoanBalance: 0,
                    totalLoanBalanceStr: '-',
                    totalMCBU: 0,
                    totalMCBUStr: '-',
                    totalNet: 0,
                    totalNetStr: '-'
                }
                branch.loans.map(loan => {
                    temp = {
                        ...temp,
                        noOfMispays: loan.totalMispayments,
                        totalAmountRelease: loan.totalAmountRelease,
                        totalAmountReleaseStr: formatPricePhp(loan.totalAmountRelease),
                        totalLoanBalance: loan.totalLoanBalance,
                        totalLoanBalanceStr: formatPricePhp(loan.totalLoanBalance),
                        totalMCBU: loan.totalMCBU,
                        totalMCBUStr: formatPricePhp(loan.totalMCBU),
                        totalNet: loan.totalNetLoanBalance,
                        totalNetStr: formatPricePhp(loan.totalNetLoanBalance),
                    }

                    totalMispays += loan.totalMispayments;
                    totalAmountRelease += loan.totalAmountRelease;
                    totalLoanBalance += loan.totalLoanBalance;
                    totalMCBU += loan.totalMCBU;
                    totalNetLoanBalance += loan.totalNetLoanBalance;
                });

                data.push(temp);
            });

            data.sort((a, b) => {
                if (a.code < b.code) {
                    return -1;
                }

                if (b.code < b.code) {
                    return 1;
                }

                return 0;
            });

            data = data.filter(branch => branch.noOfMispays > 0);

            data.push({
                _id: 'TOTALS',
                loName: 'TOTALS',
                noOfMispays: totalMispays,
                totalAmountReleaseStr: formatPricePhp(totalAmountRelease),
                totalLoanBalanceStr: formatPricePhp(totalLoanBalance),
                totalMCBUStr: formatPricePhp(totalMCBU),
                totalNetStr: formatPricePhp(totalNetLoanBalance),
                totalData: true
            });
        }
    }

    response = { success: true, data: data };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


const getByBranch = async (db, branchId, remarks, date) => {
    const ObjectId = require('mongodb').ObjectId;

    return await db.collection('branches')
        .aggregate([
            { $match: { _id: new ObjectId(branchId) } },
            { $addFields: {
                branchIdStr: { $toString: '$_id' },
            } },
            {
                $lookup: {
                    from: 'cashCollections',
                    localField: 'branchIdStr',
                    foreignField: 'branchId',
                    pipeline: [
                        { $match: { $expr: { 
                            $and: [ 
                                {$eq: ['$dateAdded', date]},
                                {$ne: ['$transfer', true]},
                                { $or: [
                                    {$cond: {
                                        if: { $eq: [remarks, 'all'] },
                                        then: {
                                            $or: [
                                                {$eq: ['$remarks.value', 'past due'] },
                                                {$eq: ['$remarks.value', 'matured-past due'] },
                                                {$eq: ['$remarks.value', 'delinquent'] },
                                                {$eq: ['$remarks.value', 'delinquent-mcbu'] },
                                                {$regexMatch: { input: '$remarks.value', regex: /^excused-/ }}
                                            ]
                                        },
                                        else: {$eq: ['$remarks.value', remarks]}
                                    }}
                                ] }
                            ] 
                        } } },
                        { $addFields: { 
                            loanBalanceInt: {$convert: {input: '$loanBalance', to : 'int', onError: 0, onNull: 0}}, 
                            mcbuInt: {$convert: {input: '$mcbu', to : 'int', onError: 0, onNull: 0}}
                        } },
                        { $group: {
                            _id: '$branchId',
                            totalMispayments: { $sum: { $cond: {
                                if: { $eq: ['$mispayment', true] },
                                then: 1,
                                else: 0
                            } } },
                            totalAmountRelease: { $sum: '$amountRelease' },
                            totalLoanBalance: { $sum: '$loanBalance' },
                            totalMCBU: { $sum: '$mcbu' },
                            totalNetLoanBalance: { $sum: { $subtract: ['$loanBalanceInt', '$mcbuInt'] } },
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