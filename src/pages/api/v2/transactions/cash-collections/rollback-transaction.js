import { CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { findClients, findGroups, findLoans } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';

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
      const groupCache = {};
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
        const currentLoan = findLoans({ _id: { _eq: loan_history._id } });

        const [client] = await findClients({ _id: { _eq: loan_history.data.clientId } });
        const [group] = await findGroups({ _id: { _eq: loan_history.data['groupId'] } });

        if (!groupCache[group._id]) {
          groupCache[group._id] = {
            groupId: group._id,
            slots: []
          }
        }

        // new loan should be ignore in rollback
        const ignoreRollback = (currentLoan.status == 'pending' && currentLoan.loanCycle == 1);
        if (ignoreRollback) {
          continue;
        }

         // Update loan with history data
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

          let prevLoanData = {
            ...loan_history.data,
            reverted: true,
            revertedDateTime: new Date(),
          };

          if (cashCollection?.mcbuWithdrawalId) {
            prevLoanData.mcbu = prevLoanData.mcbu + prevLoanData.mcbuWithdrawal;
            prevLoanData.mcbuWithdrawal = 0;
          }
  
          // Update loan with history data
          mutationQL.push(
            updateQl(
              LOAN_TYPE(`loan_${mutationQL.length}`),
              {
                set: { ...prevLoanData },
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

          // Delete mcbu withdrawal transaction
          if (cashCollection?.mcbuWithdrawalId) {
            mutationQL.push(
              deleteQl(
                createGraphType('mcbu_withdrawals', `_id`)(`mcbu_withdrawals_${mutationQL.length}`),
                {
                  _id: { _eq: cashCollection.mcbuWithdrawalId }
                }
              )
            );
          }

          // update client if cashCollection is closed
          if (cashCollection.status == 'closed') {
            groupCache[group._id].slots.push(cashCollection.slotNo);
            mutationQL.push(
              updateQl(
                createGraphType('client', `_id`)(`client_${mutationQL.length}`),
                {
                  set: {
                    groupId: client.oldGroupId,
                    loId: client.oldLoId,
                    oldGroupId: null,
                    oldLoId: null
                  },
                  where: {
                    _id: { _eq: client._id }
                  }
                }
              )
            )
          }
        }
      }

      // there should only be one group here
      const groups = Object.values(groupCache);
      for(const group of groups) {
        if(group.slots.length) {
          await updateGroup(mutationQL, group.groupId, group.slots);
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
      console.error(error);
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


  async function updateGroup(mutationQl, groupId, slots) {
      const [group] = await findGroups({ _id: { _eq: groupId, } });
      group.availableSlots = group.availableSlots.filter(s => !slots.includes(s));
      group.noOfClients = group.noOfClients + slots.length;
      if (group.capacity == group.noOfClients) {
          group.status = 'full';
      } else {
          group.status = 'available';
      }

      delete group._id;
      
      mutationQl.push(
          updateQl(
            createGraphType('groups', `_id`)(`groupst_${mutationQl.length}`),
            {
              set: {
                  ... group
              },
              where: {
                  _id: { _eq: groupId }
              }
            })
      );
  }