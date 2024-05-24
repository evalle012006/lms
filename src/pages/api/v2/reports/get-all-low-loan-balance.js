import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { gql } from 'node_modules/apollo-boost/lib/index';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { USER_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();

const GROUP_QL = gql`
query groups ($groupWhere: groups_bool_exp, $loanWhere: loans_bool_exp){
    groups (where: $groupWhere){
      _id
      name
      branchId
      loans (where: $loanWhere) {
          clientId
          clientName: fullName
          slotNo
          loanBalance
          amountRelease
          loanCycle
          mcbu
          noOfMisPayments: mispayment
          noOfPayments
          clientStatus: client {
              delinquent
          }
      }
    }
}
`;

const USERS_QL = gql`
query users ($_id: String, $loanWhere: loans_bool_exp){
    user: users (where: {
      _id: { _eq: $_id }
    }){
      _id
      firstName
      lastName
      branchId: designatedBranchId
    }
    
    loans: loans_aggregate (where: $loanWhere) {
      aggregate {
        totalClients: count
        totalAmountRelease: sum {amountRelease }
        totalLoanBalance: sum { loanBalance }
        totalMCBU: sum { mcbu }
      }
    }
  }
`;

const BRANCH_QL = gql`
query branches ($_id: String, $loanWhere: loans_bool_exp){
    branch: branches (where: {
      _id: { _eq: $_id }
    }){
      _id
      name
      code
    }
    
    loans: loans_aggregate (where: $loanWhere) {
      aggregate {
        totalClients: count
        totalAmountRelease: sum {amountRelease }
        totalLoanBalance: sum { loanBalance }
        totalMCBU: sum { mcbu }
      }
    }
}
`;

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

    const operator_key = {
        less_than_equal: '_lte',
        greater_than_equal: '_gte',
        equal: '_eq'
    };

    const loanWhere = {
        _and: [
            {
                status: { 
                    _eq: 'active'
                }
            },

            ... [operator_key[amountOptionObj.operator]].filter(_key => !!_key)
                            .map(_key => ({
                                loanBalance: {
                                    [_key]: parseInt(amountOptionObj.amount)
                                }
                            })),

            ... [operator_key[noOfPaymentsOptionObj.operator]].filter(_key => !!_key)
                            .map(_key => ({
                                noOfPayments: {
                                    [_key]: parseInt(noOfPaymentsOptionObj.amount)
                                }
                            }))
        ]
    }

    if (loId) {
        data = await graph.apollo.query({
            query: GROUP_QL,
            variables: {
                groupWhere: {
                    loanOfficerId: { _eq: loId },
                    noOfClients: { _neq: 0 }
                },
                loanWhere,
            }
        }).then(r => r.data.groups ?? []);

    }  else if (branchId) {
        const userIds = await graph.query(queryQl(createGraphType('users', `_id`)('users'), { 
            where: { role: { _contains: { rep: 4 } } },
            order_by: [{ loNo: 'asc' }],
        })).then(res => res.data.users.map(u => u._id));

        data = await Promise.all(userIds.map(async _id => await getQueryById(USERS_QL, _id, {
            loId: { _eq: _id },
            ... loanWhere
        })));
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

        data = await Promise.all(branchIdsObj.map(async _id => await getQueryById(BRANCH_QL, _id, {
            branchId: { _eq: _id },
            ... loanWhere
        })));
    }

    response = { success: true, data: data };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const getQueryById = async (query, _id, loanWhere) => await graph.apollo.query(
        {
            query,
            variables: {
                _id,
                loanWhere,
            }
        })
          .then(res => res.data.map(u => ({
            ... u.branch?.[0],
            loans: u.loans.map(l => ({
                _id,
                totalClients: l.aggregate.totalClient,
                totalAmountRelease: l.aggregate.totalAmountRelease,
                totalLoanBalance: l.aggregate.totalLoanBalance,
                totalMCBU: l.aggregate.totalMCBU
            }))
        })))