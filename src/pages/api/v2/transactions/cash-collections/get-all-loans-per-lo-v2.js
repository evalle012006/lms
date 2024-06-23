import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import logger from '@/logger';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    get: getData
});



async function getData(req, res) {
    const { date, mode, loIds, dayName, currentDate } = req.query;
    let statusCode = 200;
    let response = {};

    const loIdsObj = JSON.parse(loIds);
    const { data, error } = await getAllLoansPerGroup(date, mode, loIdsObj, dayName, currentDate).then(data => ({ data })).catch(error => ({ error }));

    if(data) {
      
      data.sort((a, b) => { return a.loNo - b.loNo });
      response = { success: true, data: data };
    }
    else {

        statusCode = 500;
        response = { error, message: "Error fetching data" };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoansPerGroup(date, mode, loIds, dayName, currentDate) {
    let cashCollection;

    if (currentDate === date) {
      dayName = moment(date).format('dddd').toLowerCase();
      cashCollection = await graph.apollo.query({
          query: gql`
          query loan_group ($day_name: String!, $curr_date: date!, $loIds: [String!]!) {
              collections: get_all_loans_per_lo_by_curr_date_and_day_name(args: {
                day_name: $day_name,
                curr_date: $curr_date
              }, where: {
                _id: {
                  _in: $loIds
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
              loIds
          }
      })
        .then(res => res.data)
        .then(res => res.collections.map(c => c.data));
    } else {
      
        cashCollection = await graph.apollo.query({
            query: gql`
            query loan_group ($day_name: String!, $date_added: date!, $loIds: [String!]!) {
                collections: get_all_loans_per_lo_by_date_added_and_day_name(args: {
                  day_name: $day_name,
                  date_added: $date_added
                }, where: {
                  _id: {
                    _in: $loIds
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
                loIds
            }
        })
        .then(res => res.data)
        .then(res => res.collections.map(c => c.data));
    }

    return cashCollection.map(c => ({
      ... c,
      cashCollections: c.cashCollections ? [c.cashCollections] : [],
      loans: c.loans ? [c.loans] : [],
      activeLoans: c.activeLoans ? [c.activeLoans] : [],
      currentRelease: c.currentRelease ? [c.currentRelease] : [],
      fullPayment: c.fullPayment ? [c.fullPayment] : [],
    }))
}