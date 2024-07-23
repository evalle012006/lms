import { GraphProvider } from '@/lib/graph/graph.provider';
import { formatPricePhp } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    let response;
    let statusCode = 200;

    const { loId, currentUserId, branchId, date, remarks } = req.query;

    let data = [];

    if (loId) {
            const groupData = await graph.apollo.query({
                query: gql`
                query mispayment_query ($loId: String!, $dateAdded: date!, $remarks: String!) {
                    collections: get_all_misspayment_by_lo( args: {
                        lo_id: $loId,
                        date_added: $dateAdded,
                        remarks: $remarks
                    }) { 
                        _id 
                        data 
                    }
                }`,
                variables: {
                    loId,
                    dateAdded: date,
                    remarks,
                }
            })
            .then(res => {
                console.log(res);
                return res;
            })
            .then(res => res.data.collections.map(c => c.data));
            

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

        const loData = await graph.apollo.query({
            query: gql`
            query mispayment_query ($branchId: String!, $dateAdded: date!, $remarks: String!) {
                collections: get_all_misspayment_by_branch( args: {
                    branch_id: $branchId,
                    date_added: $dateAdded,
                    remarks: $remarks
                }) { 
                    _id 
                    data 
                }
            }`,
            variables: {
                loId,
                branchId,
                dateAdded: date,
                remarks,
            }
        })
        .then(res => {
            console.log(res);
            return res;
        }).then(res => res.data.collections.map(c => c.data));

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
        const branchData = await graph.apollo.query({
            query: gql`
            query mispayment_query ($currentUserId: String, $dateAdded: date!, $remarks: String!) {
                collections: get_all_misspayment_by_user(args: {
                    user_id: $currentUserId,
                    date_added: $dateAdded,
                    remarks: $remarks
                }) { 
                    _id 
                    data 
                }
            }`,
            variables: {
                currentUserId,
                dateAdded: date,
                remarks,
            }
        })
        .then(res => {
            console.log(res);
            return res;
        })
        .then(res => res.data.collections.map(c => c.data))

        if (branchData) {
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
