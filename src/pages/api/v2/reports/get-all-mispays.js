import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { formatPricePhp } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();
const GROUP_QL = gql`
query groups ($groupWhere: groups_bool_exp, $cashCollectionsWhere: cashCollections_bool_exp) {
    groups(where: $groupWhere) {
      name
      branchId
      loans: cashCollections (where: $cashCollectionsWhere) {
        clientId
        slotNo
        loanBalance
        loanBalance
        amountRelease
        loanCycle
        mcbu
        noOfPayments
        remarks
        client {
            firstName
            lastName
            delinquent
            fullName
        }
      }
    }
 }
`;

const USER_QL = gql`
query users ($_id: String, $cashCollectionsWhere: cashCollections_bool_exp) {
    data: users(where: {
      _id: { _eq: $_id } 
    }) {
      _id
     firstName
      lastName
      branchId: designatedBranchId
      loNo
    }
    
    loans: cashCollections_aggregate(where: $cashCollectionsWhere) {
      aggregate {
        totalMispayments: sum { mispayment_int }
        totalAmountRelease: sum { amountRelease }
        totalLoanBalance: sum { loanBalance }
        totalMCBU: sum { mcbu }
        totalNetLoanBalance: sum { netLoanBalance }
      }
    }
}
`;

const BRANCH_QL = gql`
query branches ($_id: String, $cashCollectionsWhere: cashCollections_bool_exp) {
    data: branches(where: {
      _id: { _eq: $_id } 
    }) {
      _id
      name
      code
    }
    
    loans: cashCollections_aggregate(where: $cashCollectionsWhere) {
      aggregate {
        totalMispayments: sum { mispayment_int }
        totalAmountRelease: sum { amountRelease }
        totalLoanBalance: sum { loanBalance }
        totalMCBU: sum { mcbu }
        totalNetLoanBalance: sum { netLoanBalance }
      }
    }
}
`;

const getQueryById = async (query, _id, cashCollectionsWhere) => await graph.apollo.query(
    {
        query,
        variables: {
            _id,
            cashCollectionsWhere,
        }
    })
      .then(res => res.data.map(u => ({
        ... u.data?.[0],
        loans: u.loans.map(l => ({
            _id,
            ... l.aggregate.totalClient
        }))
    })));

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    let response;
    let statusCode = 200;

    const { loId, currentUserId, branchId, date, remarks } = req.query;
    let data = [];

    const cashCollectionsWhere = {
        _and: [
            {
                dateAdded: { _eq: date },
            },
            {
                _or: remarks === ('all' ? ['past due', 'matured-past due', 'delinquent', 'delinquent-mcbu', 'execused%'] : [val])
                .map(val => ({
                    remarks: {
                        _ilike: `%value%:%"${val}"%`
                    }
                }))
            }
        ]
    }

    if (loId) {
        const groupData = await graph.apollo.query({
            query: GROUP_QL,
            variables: {
                groupWhere: {
                    loanOfficerId: { _eq: loId },
                    noOfClients: { _neq: 0 },
                },
                cashCollectionsWhere,
            }
        }).map(res => res.data.groups)
          .map(groups => groups.map(g => ({
            ... g,
            cashCollections: g.cashCollections.map(c => ({
                ... c,
                client: c.client ? [c.client] : [],
                netLoanBalance: c.loanBalance - c.mcbu,
                remarks: c.remarks ? JSON.parse(c.remarks).value : null
            })),
          })))

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
        const userIds = await graph.query(queryQl(createGraphType('users', `_id`)('users'), { 
            where: { role: { _contains: { rep: 4 } } },
            order_by: [{ loNo: 'asc' }],
        })).then(res => res.data.users.map(u => u._id));

        const loData = await Promise.all( 
            userIds.map( async _id => await getQueryById(USER_QL, _id, {
                loId: { _eq: _id },
                ... cashCollectionsWhere,
            }))
        );

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
        let branchIdsObj = [];
        if(currentUserId) {
            const user = await graph.query(queryQl(createGraphType('users', `${USER_FIELDS}`), { where: { _id: { _eq: currentUserId } }})).then(res => res.data.users);
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
            branchIdsObj = await graph.query(queryQl(createGraphType('branches', '_id')('branches'))).then(res => res.data.branches.map(b => b._id));
        }
        
        const branchData = await Promise.all(branchIdsObj.map(async _id => await getQueryById(BRANCH_QL, _id, {
            branchId: { _eq: _id },
            ... cashCollectionsWhere
        })));

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

    response = { success: true, data: data };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

