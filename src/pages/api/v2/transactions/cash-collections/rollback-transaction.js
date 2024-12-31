import { CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';

const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `${CASH_COLLECTIONS_FIELDS}`)
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`)
const CLIENT_TYPE = createGraphType('client', `${CLIENT_FIELDS}`);
const GROUP_TYPE = createGraphType('groups', `${GROUP_FIELDS}`)

export default apiHandler({
    post: revert,
});

let statusCode = 200;
let response = {};

/*
const getClientById = (_id) => graph.query(queryQl(CLIENT_TYPE('clients'), { where: { _id: { _eq: _id } } })).then(res => res.data.clients);
const getLoanById = (_id) => graph.query(queryQl(LOAN_TYPE('loans'), {where: { _id: { _eq: _id } }})).then(res =>  res.data.loans);
 */

async function revert(req, res) {
    const user_id = req?.auth?.sub;
    const cashCollections = req.body;
    let statusCode = 200;
    let response = {};
    const mutationQL = [];
  
    try {
      // Process each cash collection sequentially to avoid race conditions
      for (const cc of cashCollections) {
        let cashCollection = {...cc};
        let loanId = cashCollection.loanId;
        if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
            loanId = cashCollection.prevLoanId;
        }

        logger.debug({
          user_id, 
          page: `Reverting Transaction Loan: ${cashCollection.clientId}`, 
          data: cashCollection
        });
        
        // Get loan history
        const loanHistoryResult = await graph.query(
          queryQl(createGraphType('loans_history', `_id data`)('loan_history'), {
            where: {
              loan_id: { _eq: loanId }
            },
            limit: 1,
            order_by: [{
              created_dt: 'desc'
            }]
          })
        );
  
        const loan_history = loanHistoryResult.data?.loan_history?.[0];
  
        if (loan_history) {
          // Delete cash collection
          mutationQL.push(
            deleteQl(
              CASH_COLLECTION_TYPE(`cash_collection_${mutationQL.length}`),
              {
                _id: { _eq: cashCollection._id }
              }
            )
          );

          console.log('status:', cashCollection.status)
          if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
            // Delete new loan
            mutationQL.push(
                deleteQl(
                createGraphType('loans', `_id`)(`loans_${mutationQL.length}`),
                {
                    _id: { _eq: cashCollection.loanId }
                }
                )
            );
          }
  
          // Update loan with history data
          mutationQL.push(
            updateQl(
              LOAN_TYPE(`loan_${mutationQL.length}`),
              {
                set: loan_history.data,
                where: {
                  _id: { _eq: loanId }
                }
              }
            )
          );
  
          // Delete loan history
          mutationQL.push(
            deleteQl(
              createGraphType('loans_history', `_id`)(`loan_history_${mutationQL.length}`),
              {
                _id: { _eq: loan_history._id }
              }
            )
          );
        }
      }
  
      // Execute mutations if there are any
      if (mutationQL.length > 0) {
        const result = await graph.mutation(...mutationQL);
        response = { success: true, data: result?.data };
      } else {
        response = { success: false, message: "No valid records to revert" };
      }
  
    } catch (error) {
      logger.error({
        user_id,
        page: 'Rollback Transaction Error',
        error: error.message,
        stack: error.stack
      });
  
      statusCode = 500;
      response = { 
        success: false, 
        error: error.message 
      };
    } finally {
      // Always send a response
      res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
    }
  }