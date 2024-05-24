import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { gql } from 'node_modules/apollo-boost/lib/index';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

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

    const { loId, branchIds, branchId, amount, operator } = req.query;
    let data = [];

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
            ... [operator_key[operator]].filter(_key => !!_key)
                            .map(_key => ({
                                loanBalance: {
                                    [_key]: parseInt(amount)
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

        data = await Promise.all(userIds.map(async _id => await getQueryById(USERS_QL, branchId, loanWhere)));
    } else {
        let branchIdsObj;
        if (branchIds) {
            branchIdsObj = JSON.parse(branchIds);
        } else {
            branchIdsObj = await graph.query(queryQl(createGraphType('branches', '_id')('branches'))).then(res => res.data.branches.map(b => b._id));
        }

        data = await Promise.all(branchIdsObj.map(async _id => await getQueryById(BRANCH_QL, branchId, loanWhere)));
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