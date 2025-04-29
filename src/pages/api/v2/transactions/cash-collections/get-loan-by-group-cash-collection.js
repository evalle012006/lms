import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';


export default apiHandler({
    get: getLoanWithCashCollection
});


const graph = new GraphProvider();

async function getLoanWithCashCollection(req, res) {

    const { date, type, groupId } = req.query;

    let statusCode = 200;
    let response = {};
    let cashCollection;

    let cashCollectionDay = [];
    let tomorrowPending = [];

    cashCollectionDay = await graph.apollo.query({
        query: gql`
        query groups ($args: get_loans_per_group_cashcollection_collection_day_by_type_arguments!) {
            collections: get_loans_per_group_cashcollection_collection_day_by_type(args: $args) {
              data
              _id
            }
        }
        `,
        variables: {
           args: {
                curr_date: date,
                curr_type: type,
                group_id: groupId
           }
        }
    }).then(res => res.data.collections.map(c => c.data));

    if(type == 'current') {
        tomorrowPending = await graph.apollo.query({
            query: gql`
            query groups ($args: get_loans_per_group_cashcollection_tomorrow_pending_arguments!) {
                collections: get_loans_per_group_cashcollection_tomorrow_pending(args: $args) {
                  _id,
                  data
                }
              }
            `,
            variables: {
               args: {
                    curr_date: date,
                    group_id: groupId
               }
            }
        }).then(res => res.data.collections.map(c => c.data));
    }

    cashCollection = {
        collection: cashCollectionDay.map(c => ({
            ... c.details,
            type: c.curr_type,
            client:c.client,
            group: c.group,
            current: c.current ?? [],
            currentRelease: c.currentRelease ?? [],
            fullPayment: c.fullPayment ?? [],
            mcbuWithdrawalList: c.mcbuWithdrawals ?? [],
        })).sort((a, b) => a.slotNo - b.slotNo),
        tomorrowPending: tomorrowPending.map(c => ({
            ... c,
            branch: c.branch?.[0],
            client: c.client?.[0],
            current: c.current?.[0],
            current: c.current ?? [],
            currentRelease: c.currentRelease ?? [],
            fullPayment: c.fullPayment ?? [],
            prevLoans: c.prevLoans ?? [],
        }))
        .sort((a, b) => a.slotNo - b.slotNo),
    };

    response = { success: true, data: cashCollection };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}