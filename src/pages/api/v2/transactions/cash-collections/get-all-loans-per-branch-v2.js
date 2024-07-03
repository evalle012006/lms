import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

export default apiHandler({
    get: getData
});

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `${USER_FIELDS}`)('users');
const BRANCH_TYPE = createGraphType('branches', `_id`)('branches');

async function getData (req, res) {
    let statusCode = 200;
    let response = {};

    const { date, currentUserId, selectedBranchGroup, dayName, currentDate } = req.query;
    const user = graph.query(
        queryQl(USER_TYPE, { where: { _id: { _eq: currentUserId } } })
    ).then(res => res.users);

    const getBranchIds = (where) => graph.query(queryQl(BRANCH_TYPE, {where})).then(res => res.branches.map(b => b._id));

    if (user.length > 0) {
        let branchIds = [];
        if (selectedBranchGroup == 'mine' && user[0].role.rep !== 1) {
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                branchIds = await getBranchIds({ areaId: { _eq: user[0].areaId } })
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                branchIds = await getBranchIds({ regionId: { _eq: user[0].regionId } })
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                branchIds = await getBranchIds({ divisionId: { _eq: user[0].divisionId } })
            }
        } else {
            branchIds = await getBranchIds({ });
        }
        
        const data = [];
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(branchIds.map(async (branchId) => {
                logger.debug({page: 'Branch Collections', message: `Getting data for branch id: ${branchId}`});
                data.push.apply(data, await getAllLoanTransactionsByBranch(branchId, date, dayName, currentDate));
            }));

            resolve(response);
        });

        if (promise) {
            data.sort((a, b) => {
                if (a.code > b.code) {
                    return 1;
                }

                if (b.code > a.code) {
                    return -1;
                }
                
                return 0;
            });
            response = { success: true, data: data };
        } else {
            statusCode = 500;
            response = { error: true, message: "Error fetching data" };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoanTransactionsByBranch(branchId, date, dayName, currentDate) {

    let cashCollection;
    if (currentDate === date) {
        cashCollection = await graph.apollo.query({
            query: gql`
            query loan_group ($day_name: String!, $curr_date: date!, $branchId: String!) {
                collections: get_all_loans_per_branch_by_curr_date_and_day_name(limit: 1, args: {
                  day_name: $day_name,
                  curr_date: $curr_date
                }, where: {
                  _id: {
                    _in: $branchId
                  }
                }) {
                  _id
                  data
                }
            }
            `,
            variables: {
                day_name: dayName,
                curr_date: date,
                branchId,
            }
        }).then(res => res.data.collections.map(c => c.data));
    } else {
        cashCollection = await graph.apollo.query({
            query: gql`
            query loan_group ($day_name: String!, $date_added: date!, $branchId: String!) {
                collections: get_all_loans_per_branch_by_date_added_and_day_name(limit: 1, args: {
                  day_name: $day_name,
                  date_added: $date_added
                }, where: {
                  _id: {
                    __eq: $branchId
                  }
                }) {
                  _id
                  data
                }
            }
            `,
            variables: {
                day_name: dayName,
                date_added: date,
                branchId,
            }
        }).then(res => res.data.collections.map(c => c.data));
    }
     
    return cashCollection.map(c => ({
        ... c,
        cashCollections: c.cashCollections ?? [],
        loans: c.loans ?? [],
        activeLoans: c.activeLoans ?? [],
        currentRelease: c.currentRelease ?? [],
        fullPayment: c.fullPayment ?? [],
        transferGiverDetails: c.transferGiverDetails ?? [],
        transferReceivedDetails: c.transferReceivedDetails ?? []
      }))
}