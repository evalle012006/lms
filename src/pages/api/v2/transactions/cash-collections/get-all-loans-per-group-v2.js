import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import moment from  'moment';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    get: getData
});

async function getData(req, res) {
    const { date, mode, groupIds, dayName, currentDate } = req.query;
    let statusCode = 200;
    let response = {};

    const groupIdsObj = JSON.parse(groupIds);
    const data = [];

    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(groupIdsObj.map(async (groupId) => {
            data.push.apply(data, await getAllLoansPerGroup(date, mode, groupId, dayName, currentDate));
        }));

        resolve(response);
    });

    if (promise) {
        data.sort((a,b) => { return a.groupNo - b.groupNo });
        response = { success: true, data: data };
    } else {
        statusCode = 500;
        response = { error: true, message: "Error fetching data" };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoansPerGroup(date, mode, groupId, dayName, currentDate) {

    let cashCollection;

    if (currentDate === date) {
      dayName = moment(date).format('dddd').toLowerCase();
      cashCollection = await graph.apollo.query({
          query: gql`
          query loan_group ($day_name: String!, $curr_date: date!, $groupId: String!) {
              collections: get_all_loans_per_group_by_curr_date_and_day_name(limit: 1, args: {
                day_name: $day_name,
                curr_date: $curr_date
              }, where: {
                _id: {
                  _eq: $groupId
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
              groupId,
          }
      }).then(res => res.data.collections.map(c => c.data));
    } else {
        cashCollection = await graph.apollo.query({
            query: gql`
            query loan_group ($day_name: String!, $date_added: date!, $groupId: String!) {
                collections: get_all_loans_per_group_by_date_added_and_day_name(limit: 1, args: {
                  day_name: $day_name,
                  date_added: $date_added
                }, where: {
                  _id: {
                    _eq: $groupId
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
                groupId,
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