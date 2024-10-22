import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { gql } from 'node_modules/apollo-boost/lib/index';
import { formatPricePhp } from '@/lib/utils';

const graph = new GraphProvider();

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    const { db } = await connectToDatabase();
    let response;
    let statusCode = 200;

    const { loId, currentUserId, branchId, amountOption, noOfPaymentsOption } = req.query;
    let data = [];
    const amountOptionObj = JSON.parse(amountOption);
    const noOfPaymentsOptionObj = JSON.parse(noOfPaymentsOption);

    if (loId) {
        const groupData = await graph.apollo.query({
            query: gql`
            query all_low_loan_balance_by_lo ($loId: String!, $amount: numeric!, $noOfPayments: numeric!, $amountOperator: String!, $noOfPaymentsOperator: String!) {
                collections: get_all_low_loan_balance_by_lo( args: {
                    lo_id: $loId,
                    amount: $amount,
                    amountOperator: $amountOperator,
                    noOfPaymentsOperator: $noOfPaymentsOperator,
                    noOfPayments: $noOfPayments
                }) { 
                    _id 
                    data 
                }
            }`,
            variables: {
                loId,
                amount: +amountOptionObj.amount,
                amountPperator: amountOptionObj.operator,
                noOfPayments: noOfPaymentsOptionObj.noOfPayments,
                noOfPaymentsOperator: noOfPaymentsOptionObj.operator,
            }
        }).then(res => res.data.collections)
           .map(collections => collections.map(c => ({
            ... c,
            clientStatus: [c.clientStatus]
        })));

        if (groupData) {
            let totalClients = 0;
            let totalAmountRelease = 0;
            let totalLoanBalance = 0;
            let totalMCBU = 0;

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
                        noOfPayments: loan.noOfPayments,
                        delinquent: delinquent
                    });

                    totalClients += 1;
                    totalAmountRelease += loan.amountRelease;
                    totalLoanBalance += loan.loanBalance;
                    totalMCBU += loan.mcbu;
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
                noOfPayments: '-',
                delinquent: '-',
                totalData: true
            });
        }

    }  else if (branchId) {
        const loData = await graph.apollo.query({
            query: gql`
            query get_all_low_loan_balance_by_branch_los ($branchId: String!, $amount: numeric!, $noOfPayments: numeric!, $amountOperator: String!, $noOfPaymentsOperator: String!) {
                collections: get_all_low_loan_balance_by_branch_los( args: {
                    branchId: $branchId,
                    amount: $amount,
                    amountOperator: $amountOperator,
                    noOfPaymentsOperator: $noOfPaymentsOperator,
                    noOfPayments: $noOfPayments
                }) { 
                    _id 
                    data 
                }
            }`,
            variables: {
                branchId,
                amount: +amountOptionObj.amount,
                amountOperator: amountOptionObj.operator,
                noOfPayments: noOfPaymentsOptionObj.noOfPayments,
                noOfPaymentsOperator: noOfPaymentsOptionObj.operator,
            }
        }).then(res => res.data.collections ?? [])
          .then(collections => collections.map(a => a.data))

        let totalNoOfClients = 0;
        let totalAmountRelease = 0;
        let totalLoanBalance = 0;
        let totalMCBU = 0;

        if (loData) {
            loData.map(lo => {
                let temp = {
                    _id: lo._id,
                    loName: `${lo.firstName} ${lo.lastName}`
                }
                lo.loans.map(loan => {
                    temp = {
                        ...temp,
                        noOfClients: loan.totalClients,
                        totalAmountRelease: loan.totalAmountRelease,
                        totalAmountReleaseStr: formatPricePhp(loan.totalAmountRelease),
                        totalLoanBalance: loan.totalLoanBalance,
                        totalLoanBalanceStr: formatPricePhp(loan.totalLoanBalance),
                        totalMCBU: loan.totalMCBU,
                        totalMCBUStr: formatPricePhp(loan.totalMCBU)
                    };
    
                    totalNoOfClients += loan.totalClients;
                    totalAmountRelease += loan.totalAmountRelease;
                    totalLoanBalance += loan.totalLoanBalance;
                    totalMCBU += loan.totalMCBU;
                });
    
                data.push(temp);
            });
    
            data.sort((a, b) => { return a.loanBalance - b.loanBalance });
    
            data = data.filter(lo => lo.noOfClients > 0);
    
            data.push({
                _id: 'TOTALS',
                loName: 'TOTALS',
                noOfClients: totalNoOfClients,
                totalAmountReleaseStr: formatPricePhp(totalAmountRelease),
                totalLoanBalanceStr: formatPricePhp(totalLoanBalance),
                totalMCBUStr: formatPricePhp(totalMCBU),
                totalData: true
            });
        }
    } else {
        
        const branchData = await graph.apollo.query({
            query: gql`
            query get_all_low_balance_by_branches ($userId: String!, $amount: numeric!, $noOfPayments: numeric!, $amountOperator: String!, $noOfPaymentsOperator: String!) {
                collections: get_all_low_balance_by_branches( args: {
                    userId: $userId,
                    amount: $amount,
                    amountOperator: $amountOperator,
                    noOfPaymentsOperator: $noOfPaymentsOperator,
                    noOfPayments: $noOfPayments
                }) { 
                    _id 
                    data 
                }
            }`,
            variables: {
                userId: currentUserId,
                amount: +amountOptionObj.amount,
                amountOperator: amountOptionObj.operator,
                noOfPayments: noOfPaymentsOptionObj.noOfPayments,
                noOfPaymentsOperator: noOfPaymentsOptionObj.operator,
            }
        }).then(res => res.data.collections ?? [])
          .then(collections => collections.map(a => a.data))

        if (branchData) {
            let totalNoOfClients = 0;
            let totalAmountRelease = 0;
            let totalLoanBalance = 0;
            let totalMCBU = 0;

            branchData.map(branch => {
                let temp = {
                    _id: branch._id,
                    code: branch.code,
                    name: branch.name,
                    noOfClients: 0,
                    totalAmountRelease: 0,
                    totalAmountReleaseStr: '-',
                    totalLoanBalance: 0,
                    totalLoanBalanceStr: '-',
                    totalMCBU: 0,
                    totalMCBUStr: '-'
                }
                branch.loans.map(loan => {
                    temp = {
                        ...temp,
                        noOfClients: loan.totalClients,
                        totalAmountRelease: loan.totalAmountRelease,
                        totalAmountReleaseStr: formatPricePhp(loan.totalAmountRelease),
                        totalLoanBalance: loan.totalLoanBalance,
                        totalLoanBalanceStr: formatPricePhp(loan.totalLoanBalance),
                        totalMCBU: loan.totalMCBU,
                        totalMCBUStr: formatPricePhp(loan.totalMCBU),
                        totalNet: loan.totalNetLoanBalance,
                        totalNetStr: formatPricePhp(loan.totalNetLoanBalance),
                    }

                    totalNoOfClients += loan.totalClients;
                    totalAmountRelease += loan.totalAmountRelease;
                    totalLoanBalance += loan.totalLoanBalance;
                    totalMCBU += loan.totalMCBU;
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

            data = data.filter(branch => branch.noOfClients > 0);

            data.push({
                _id: 'TOTALS',
                name: '-',
                code: 'TOTALS',
                noOfClients: totalNoOfClients,
                totalAmountReleaseStr: formatPricePhp(totalAmountRelease),
                totalLoanBalanceStr: formatPricePhp(totalLoanBalance),
                totalMCBUStr: formatPricePhp(totalMCBU),
                totalData: true
            });
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