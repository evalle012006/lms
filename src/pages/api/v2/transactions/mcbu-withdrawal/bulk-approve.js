import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { updateQl, createGraphType, insertQl, queryQl } from "@/lib/graph/graph.util";
import { CASH_COLLECTIONS_FIELDS, MCBU_WITHDRAWAL_FIELDS, LOAN_FIELDS, GROUP_FIELDS } from "@/lib/graph.fields";
import { filterGraphFields } from '@/lib/graph.functions';
import { generateUUID, getCurrentDate } from '@/lib/utils';
import logger from '@/logger';
import moment from 'moment';

const graph = new GraphProvider();
const mcbuWithdrawalsType = createGraphType(
  "mcbu_withdrawals",
  MCBU_WITHDRAWAL_FIELDS
);

const cashCollectionsType = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS);
const loansType = createGraphType('loans', LOAN_FIELDS);
const groupType = createGraphType('groups', GROUP_FIELDS);

export default apiHandler({
  post: bulkApprove,
});

async function bulkApprove(req, res) {
  try {
    const user_id = req?.auth?.sub;
    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
    const mutationList = [];
    const addToMutationList = addToList => mutationList.push(addToList(`bulk_update_${mutationList.length}`));

    logger.debug({user_id, page: `Approving MCBU Withdrawal`});

    const { withdrawals } = req.body;
    
    if (!withdrawals || !Array.isArray(withdrawals) || withdrawals.length === 0) {
      return res.status(400).json({
        error: true,
        message: "Withdrawals array is required and must not be empty"
      });
    }
    
    const results = [];
    const errors = [];
    
    // Process each withdrawal update
    for (const withdrawal of withdrawals) {
      const { id, loan_id, mcbu_withdrawal_amount, modified_by, modified_date } = withdrawal;
      
      if (!id) {
        errors.push({ error: true, message: "Withdrawal ID is required", withdrawal });
        continue;
      }
      
      try {
        // Get the loan information for this withdrawal
        const loanResponse = await graph.query(
          queryQl(loansType(), {
            where: { _id: { _eq: loan_id } }
          })
        );
        
        const loan = loanResponse.data?.loans?.[0];
        
        if (!loan) {
          errors.push({ 
            error: true, 
            message: `Loan with ID ${loan_id} not found`, 
            withdrawal 
          });
          continue;
        }
        
        // Get the group information for this loan
        const groupResponse = await graph.query(
          queryQl(groupType(), {
            where: { _id: { _eq: loan.groupId } }
          })
        );
        
        const group = groupResponse.data?.groups?.[0];
        
        if (!group) {
          errors.push({ 
            error: true, 
            message: `Group with ID ${loan.groupId} not found`, 
            withdrawal 
          });
          continue;
        }
        
        // Set up the update data for withdrawal
        const updateData = {
          status: 'approved',
          approved_date: currentDate,
          modified_by: modified_by,
          modified_date: modified_date || new Date().toISOString()
        };
        
        // Execute update query for the MCBU withdrawal
        const withdrawalResult = await graph.mutation(
          updateQl(mcbuWithdrawalsType(), {
            where: { _id: { _eq: id } },
            set: updateData
          })
        );
        
        if (withdrawalResult.errors) {
          errors.push({ 
            error: true, 
            message: withdrawalResult.errors[0].message, 
            withdrawal 
          });
        } else {
          // Check if any records were updated
          if (withdrawalResult.data.mcbu_withdrawals.returning.length > 0) {
            // Update the loan with withdrawal information
            const withdrawalAmount = parseFloat(mcbu_withdrawal_amount) || 0;
            const updatedLoan = {
              ...loan,
              mcbu: Math.max(0, (parseFloat(loan.mcbu) || 0) - withdrawalAmount),
              mcbuWithdrawal: (parseFloat(loan.mcbuWithdrawal) || 0) + withdrawalAmount,
              modifiedBy: user_id,
              modifiedDateTime: new Date().toISOString()
            };
            
            // Add loan update to mutation list
            addToMutationList(alias => updateQl(loansType(alias), {
              where: { _id: { _eq: loan_id } },
              set: filterGraphFields(LOAN_FIELDS, {
                ...updatedLoan,
                mcbu: updatedLoan.mcbu,
                mcbuWithdrawal: updatedLoan.mcbuWithdrawal
              })
            }));
            
            const groupCashCollections = (await graph.query(queryQl(cashCollectionsType(), {
              where: {
                groupId: { _eq: loan.groupId },
                dateAdded: { _eq: currentDate },
              }
            }))).data?.cashCollections;
            
            let groupStatus = 'pending';
            if (groupCashCollections.length > 0) {
              const groupStatuses = groupCashCollections.filter(cc => cc.groupStatus === 'pending');
              if (groupStatuses.length === 0) {
                groupStatus = 'closed';
              }
            }
            
            // Now save the cash collection
            await saveCashCollection(
              user_id, 
              updatedLoan,
              withdrawalAmount,
              group, 
              loan_id, 
              currentDate, 
              groupStatus, 
              addToMutationList
            );
            
            // Execute all mutations
            if (mutationList.length > 0) {
              try {
                await graph.mutation(...mutationList);
              } catch (mutationError) {
                console.error("Error executing mutations:", mutationError);
                errors.push({ 
                  error: true, 
                  message: `Error executing mutations: ${mutationError.message}`, 
                  withdrawal 
                });
                continue;
              }
            }
            
            results.push({
              success: true,
              id: id,
              data: withdrawalResult.data.mcbu_withdrawals.returning[0]
            });
          } else {
            errors.push({ 
              error: true, 
              message: "Withdrawal not found or not updated", 
              withdrawal 
            });
          }
        }
      } catch (error) {
        errors.push({ 
          error: true, 
          message: `Error updating withdrawal: ${error.message}`, 
          withdrawal 
        });
      }
    }
    
    // Return results with success/error status
    return res.status(200).json({
      success: errors.length === 0,
      message: `Successfully approved ${results.length} of ${withdrawals.length} withdrawals${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error in bulk approve:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to process bulk approval: " + error.message
    });
  }
}

async function saveCashCollection(user_id, loan, withdrawalAmount, group, loanId, currentDate, groupStatus, addToMutationList) {
  const currentReleaseAmount = parseFloat(loan.amountRelease || 0);

  // Check if a cash collection already exists for this client on the current date
  const cashCollection = (await graph.query(queryQl(cashCollectionsType(), {
    where: {
      clientId: { _eq: loan.clientId },
      dateAdded: { _eq: currentDate },
    }
  }))).data?.cashCollections;

  logger.debug({user_id, page: `Saving Cash Collection: ${loanId}`, cashCollection: cashCollection});
  
  if (cashCollection.length === 0) {
    let data = {
      loanId: loanId,
      branchId: loan.branchId,
      groupId: loan.groupId,
      groupName: loan.groupName,
      loId: loan.loId,
      clientId: loan.clientId,
      slotNo: loan.slotNo,
      loanCycle: loan.loanCycle,
      mispayment: 'false',
      mispaymentStr: 'No',
      collection: 0,
      excess: loan.excess,
      total: 0,
      noOfPayments: loan.noOfPayments,
      activeLoan: 0,
      targetCollection: 0,
      amountRelease: 0,
      loanBalance: 0,
      paymentCollection: 0,
      occurence: group.occurence,
      currentReleaseAmount: currentReleaseAmount,
      fullPayment: loan.fullPayment,
      mcbu: loan.mcbu || 0,
      mcbuCol: 0,
      mcbuWithdrawal: withdrawalAmount,
      mcbuReturnAmt: 0 || 0,
      remarks: '',
      status: loan.status,
      dateAdded: currentDate,
      insertedDateTime: new Date(),
      groupStatus: groupStatus,
      origin: 'automation-mcbu-withdrawal'
    };

    if (data.occurence === 'weekly') {
      data.mcbuTarget = 50;
      data.groupDay = group.day;

      if (data.loanCycle !== 1) {
        data.mcbuCol = parseFloat(loan.mcbu || 0);
      }
    }

    if (loan.status === 'reject') {
      data.rejectReason = loan.rejectReason;
    }
    
    logger.debug({user_id, page: `Saving Cash Collection: ${loan.clientId}`, data: data});
    
    addToMutationList(alias => insertQl(cashCollectionsType(alias), { 
      objects: [filterGraphFields(CASH_COLLECTIONS_FIELDS, {
        ...data,
        _id: generateUUID(),
      })]
    }));
  } else {
    // Update existing cash collection
    logger.debug({user_id, page: `Updating Cash Collection: ${loan.clientId}`});

    addToMutationList(alias => updateQl(cashCollectionsType(alias), {
      set: {
        mcbu: loan.mcbu || 0,
        mcbuWithdrawal: withdrawalAmount,
        modifiedBy: "automation-mcbu-withdrawal",
        modifiedDateTime: new Date(),
      },
      where: {
        _id: { _eq: cashCollection[0]._id }
      }
    }));
  }
}