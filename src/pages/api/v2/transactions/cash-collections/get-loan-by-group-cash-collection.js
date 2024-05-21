import { apiHandler } from '@/services/api-handler';


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
        query groups ($where:loan_group_model_bool_exp_bool_exp,  $args: get_loans_per_group_cashcollection_collection_day_by_type_arguments!) {
            collections: get_loans_per_group_cashcollection_collection_day_by_type(args: $args, where: $where) {
              data
              _id
            }
        }
        `,
        variables: {
           where: {
                _id: { _eq: groupId }
           },
           args: {
                curr_date: date,
                curr_type: type
           }
        }
    }).then(res => res.collections.map(c => c.data));

    if(type == 'current') {
        tomorrowPending = await graph.apollo.query({
            query: gql`
            query groups ($where:loan_group_model_bool_exp_bool_exp,  $args: get_loans_per_group_cashcollection_tomorrow_pending_arguments!) {
                collections: get_loans_per_group_cashcollection_tomorrow_pending(args: $args, where: $where) {
                  _id,
                  data
                }
              }
            `,
            variables: {
               where: {
                    _id: { _eq: groupId }
               },
               args: {
                    curr_date: date,
               }
            }
        }).then(res => res.collections.map(c => c.data));
    }

    cashCollection = {
        collection: cashCollectionDay,
        tomorrowPending: tomorrowPending
    };

    response = { success: true, data: cashCollection };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}