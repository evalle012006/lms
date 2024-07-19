import { CASH_COLLECTIONS_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

let response = {};
let statusCode = 200;

const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `_id`)('collections');
const graph = new GraphProvider();

export default apiHandler({
    post: processLOSummary,
    get: getLOSummary
});

async function processLOSummary(req, res) {
    const { loId, mode, currentDate, currentTime } = req.body;

    if (loId) {
        const cashCollectionCounts = await checkLoTransactions(loId, currentDate);
        if (cashCollectionCounts) {
            const noCollections = cashCollectionCounts.filter(cc => { 
                if (cc.cashCollections.length === 0) {
                    return cc;
                }
            });
            const hasDrafts = cashCollectionCounts.filter(cc => { 
                if ( cc.cashCollections.length > 0 && cc.cashCollections[0].hasDrafts > 0 ) {
                    return cc;
                }
            });

            const hasClosingTime = cashCollectionCounts.filter(cc => { 
                if ( cc.cashCollections.length > 0 && cc.cashCollections[0].hasClosingTime.length > 0 ) {
                    return cc;
                }
            });

            if (mode === 'close' && noCollections?.length > 0) {
                response = { error: true, message: "Some groups have no current transactions for the selected Loan Officer." };
            } else if (mode === 'close' && hasDrafts?.length > 0) {
                response = { error: true, message: "Some groups have draft transactions for the selected Loan Officer." };
            } else {
                let result;
                if (mode == 'close' && hasClosingTime.length == 0) {
                    result = await graph.mutation(
                        updateQl(CASH_COLLECTION_TYPE, {
                            set: {
                                groupStatus: 'closed',
                                closingTime: currentTime
                            },
                            where: {
                                loId: {  _eq: loId },
                                dateAdded: { _eq: currentDate }
                            }
                        })
                    );
                } else {
                    result = await graph.mutation(
                        updateQl(CASH_COLLECTION_TYPE, {
                            set: {
                                groupStatus: mode === 'close' ? 'closed' : 'pending',
                            },
                            where: {
                                loId: {  _eq: loId },
                                dateAdded: { _eq: currentDate }
                            }
                        })
                    );
                }

                if(result.data.collections.affected_rows === 0) {
                    response = { error: true, message: "No transactions found for this Loan Officer." };
                } else {
                    response = { success: true };
                }
            }
        }

    } else {
        response = { error: true, message: "Loan Office Id not found." };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getLOSummary(req, res) {
    const { groupIds, currentDate } = req.query;
    const ids = groupIds.split(',');

    const groups = await graph.query(
        queryQl(createGraphType('cashCollections', `${CASH_COLLECTIONS_FIELDS}`)('collections'), {
            where: { 
                groupId: { _in: ids },
                dateAdded: { _eq: currentDate }
            }
        })
    ).then(res => res.data.collections);

    response = { success: true, data: groups }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const checkLoTransactions = async (loId, currentDate) => {

    const collections = await graph.apollo.query({
        query: gql`
        query groups ($where:loan_group_model_bool_exp_bool_exp,  $args: get_lo_transaction_summary_arguments!) {
            collections: get_lo_transaction_summary(args: $args, where: $where) {
              _id,
              data
            }
          }
        `,
        variables: {
           args: {
            loId,
            dateAdded: currentDate,
           }
        }
    })
    .then(res => res.data.collections.map(c => c.data));

    return collections;
}