import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { updateQl, createGraphType, insertQl, queryQl } from "@/lib/graph/graph.util";
import { CASH_COLLECTIONS_FIELDS, MCBU_WITHDRAWAL_FIELDS, LOAN_FIELDS, GROUP_FIELDS } from "@/lib/graph.fields";
import { filterGraphFields } from '@/lib/graph.functions';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
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

    logger.debug({user_id, page: `Approving MCBU Withdrawal with CSF Support`});

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

    const validWithdrawalMap = {};

    // validated all withdrawals and add it in a map for distinct duplicates
    for(const withdrawal of withdrawals) {
      if (!validWithdrawalMap[withdrawal.id]) {
        const validWithdrawal = await validate(withdrawal.id, errors).catch(err => {
          errors.push({
            error: true,
            message: 'Error in validating withdrawal',
            withdrawal
          });
          return false;
        });

        if(!!validWithdrawal) {
          validWithdrawalMap[withdrawal.id] = validWithdrawal;
          await performApprovalWithdrawal(validWithdrawal, user_id, currentDate, addToMutationList, mutationList)
              .then(() => {
                results.push({ 
                  success: true, 
                  id: withdrawal._id, 
                  mcbu_withdrawal_amount: validWithdrawal.withdrawal.mcbu_withdrawal_amount, 
                  csf_withdrawal_amount: validWithdrawal.withdrawal.csf_withdrawal_amount, 
                  data: {
                    id: withdrawal._id,
                    ... validWithdrawal.withdrawal
                  } 
                });
              })
              .catch((err) => {
                errors.push({
                  error: true,
                  message: 'Error in saving withdrawal',
                  withdrawal
                })
              }).finally(() => {
                mutationList.length = 0
              });
        }
      }
    }

    // Return results with success/error status
    return res.status(200).json({
      success: errors.length === 0,
      message: `Successfully approved ${results.length} of ${withdrawals.length} withdrawals${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      totalMcbuAmount: results.reduce((sum, r) => sum + (r.mcbu_withdrawal_amount || 0), 0),
      totalCsfAmount: results.reduce((sum, r) => sum + (r.csf_withdrawal_amount || 0), 0)
    });
  } catch (error) {
    console.error("Error in bulk approve:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to process bulk approval: " + error.message
    });
  }
}

// Updated saveCashCollection function to include CSF withdrawal
async function saveCashCollection(user_id, loan, mcbuWithdrawalAmount, csfWithdrawalAmount, group, loanId, currentDate, groupStatus, addToMutationList) {
  const currentReleaseAmount = parseFloat(loan.amountRelease || 0);

  // Check if a cash collection already exists for this client on the current date
  const cashCollection = (await graph.query(queryQl(cashCollectionsType(), {
    where: {
      clientId: { _eq: loan.clientId },
      dateAdded: { _eq: currentDate },
    }
  }))).data?.cashCollections;

  logger.debug({
    user_id, 
    page: `Saving Cash Collection: ${loanId}`, 
    cashCollection: cashCollection,
    mcbuWithdrawal: mcbuWithdrawalAmount,
    csfWithdrawal: csfWithdrawalAmount
  });
  
  if (cashCollection.length === 0) {
    // Create new cash collection record
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
      mcbuWithdrawal: mcbuWithdrawalAmount,
      csf: loan.csf || 0, // Add CSF balance to cash collection
      csfWithdrawal: csfWithdrawalAmount, // Add CSF withdrawal to cash collection
      mcbuReturnAmt: 0 || 0,
      remarks: '',
      status: loan.status,
      dateAdded: currentDate,
      insertedDateTime: new Date(),
      groupStatus: groupStatus,
      origin: 'automation-mcbu-withdrawal'
    };

    // Weekly-specific settings
    if (data.occurence === 'weekly') {
      data.mcbuTarget = 50;
      data.groupDay = group.day;

      if (data.loanCycle !== 1) {
        data.mcbuCol = parseFloat(loan.mcbu || 0);
      }
    }

    // Handle rejected status
    if (loan.status === 'reject') {
      data.rejectReason = loan.rejectReason;
    }
    
    logger.debug({
      user_id, 
      page: `Creating Cash Collection: ${loan.clientId}`, 
      data: data
    });
    
    addToMutationList(alias => insertQl(cashCollectionsType(alias), { 
      objects: [filterGraphFields(CASH_COLLECTIONS_FIELDS, {
        ...data,
        _id: generateUUID(),
      })]
    }));
  } else {
    // Update existing cash collection
    logger.debug({
      user_id, 
      page: `Updating Cash Collection: ${loan.clientId}`,
      existingId: cashCollection[0]._id
    });

    const updateFields = {
      mcbu: loan.mcbu || 0,
      mcbuWithdrawal: (parseFloat(cashCollection[0].mcbuWithdrawal || 0)) + mcbuWithdrawalAmount,
      csf: loan.csf || 0, // Update CSF balance
      csfWithdrawal: (parseFloat(cashCollection[0].csfWithdrawal || 0)) + csfWithdrawalAmount, // Add to existing CSF withdrawal
      modifiedBy: "automation-mcbu-withdrawal",
      modifiedDateTime: new Date(),
    };

    addToMutationList(alias => updateQl(cashCollectionsType(alias), {
      set: filterGraphFields(CASH_COLLECTIONS_FIELDS, updateFields),
      where: {
        _id: { _eq: cashCollection[0]._id }
      }
    }));
  }
}

async function performApprovalWithdrawal({withdrawal, loan, group}, user_id, currentDate, addToMutationList, mutationList) {
  const { _id, loan_id, modified_by, csf_withdrawal_amount, mcbu_withdrawal_amount, modified_date } = withdrawal;

  // Validate withdrawal amounts
  const mcbuAmount = parseFloat(mcbu_withdrawal_amount) || 0;
  const csfAmount = parseFloat(csf_withdrawal_amount) || 0;
  
  const updateData = {
          status: 'approved',
          approved_date: currentDate,
          modified_by: modified_by,
          modified_date: modified_date || new Date().toISOString()
  };
  
  addToMutationList(alias => updateQl(mcbuWithdrawalsType(alias), {
    where: { _id: { _eq: _id } },
    set: updateData
  }))

  const updatedLoan = {
    mcbu: Math.max(0, (parseFloat(loan.mcbu) || 0) - mcbuAmount),
    mcbuWithdrawal: (parseFloat(loan.mcbuWithdrawal) || 0) + mcbuAmount,
    csf: Math.max(0, (parseFloat(loan.csf) || 0) - csfAmount),
    csfWithdrawal: (parseFloat(loan.csfWithdrawal) || 0) + csfAmount,
    modifiedBy: user_id,
    modifiedDateTime: new Date().toISOString()
  };
  
  // Add loan update to mutation list
  addToMutationList(alias => updateQl(loansType(alias), {
    where: { _id: { _eq: loan._id } },
    set: filterGraphFields(LOAN_FIELDS, {
      ...updatedLoan,
      mcbu: updatedLoan.mcbu,
      mcbuWithdrawal: updatedLoan.mcbuWithdrawal,
      csf: updatedLoan.csf,
      csfWithdrawal: updatedLoan.csfWithdrawal
    })
  }));
  
  // Get group cash collections for status determination
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
  
  // Save the cash collection with CSF withdrawal information
  await saveCashCollection(
    user_id, 
    {
      ... loan,
      ... updatedLoan,
    },
    mcbuAmount,
    csfAmount, // Pass CSF withdrawal amount
    group, 
    loan_id, 
    currentDate, 
    groupStatus, 
    addToMutationList
  );

  await graph.mutation(
    ... mutationList
  );
}

async function validate(id, errors) {
  const [withdrawal] = await graph.query(
    queryQl(mcbuWithdrawalsType('results'), {
      where: { _id: { _eq: id } }
    })
  ).then(res => res.data.results);

  if(!withdrawal) {
    errors.push({ 
        error: true, 
        message: `Withdrawal is not found.`,
        withdrawal: { _id: id }
    });
    return false;
  }

  const { client_id, loan_id, mcbu_withdrawal_amount, csf_withdrawal_amount, group_leader } = withdrawal;

  if (withdrawal.status !== 'pending') {
    errors.push({ 
        error: true, 
        message: `Withdrawal is already ${withdrawal.status}.`,
        withdrawal 
    });
    return false;
  } 

   const loanResponse = await graph.query(
      queryQl(loansType(), {
        where: { clientId: { _eq: client_id }, status: { _eq: 'active' } }
      })
    );
    
    const loan = loanResponse.data?.loans?.[0];
    
    if (!loan) {
      errors.push({ 
        error: true, 
        message: `Loan with ID ${loan_id} not found`, 
        withdrawal 
      });
      return false;
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
      return false;
    }
    
    // Validate withdrawal amounts
    const mcbuAmount = parseFloat(mcbu_withdrawal_amount) || 0;
    const csfAmount = parseFloat(csf_withdrawal_amount) || 0;
    
    const currentMcbu = parseFloat(loan.mcbu) || 0;
    const currentCsf = parseFloat(loan.csf) || 0;
    
    if (mcbuAmount > currentMcbu) {
      errors.push({ 
        error: true, 
        message: `MCBU withdrawal amount (${mcbuAmount}) exceeds available balance (${currentMcbu})`, 
        withdrawal 
      });

      return false;
    }
    
    // Validate CSF withdrawal amount against available balance
    if (csfAmount > currentCsf && group_leader) {

      errors.push({ 
        error: true, 
        message: `CSF withdrawal amount (${csfAmount}) exceeds available balance (${currentCsf})`,
      });
    }
    
    // Additional business logic validation for MCBU
    if (mcbuAmount > 0) { // Only validate MCBU limits if amount > 0
      // Group leaders: can only withdraw excess over 3000
      // Regular clients (daily): can only withdraw excess over 1000
      if (group_leader) {
        const maxMcbuWithdrawal = Math.max(0, currentMcbu - 3000);
        if (mcbuAmount > maxMcbuWithdrawal) {

           errors.push({ 
            error: true, 
            message: `Group leaders can only withdraw excess over ₱3,000 MCBU balance. Maximum allowed: ₱${maxMcbuWithdrawal}`,
            withdrawal
          });

          return false;
        }
      } else {
        // Assuming daily occurrence for regular clients - this could be enhanced with actual occurrence check
        const maxMcbuWithdrawal = Math.max(0, currentMcbu - 1000);
        if (mcbuAmount > maxMcbuWithdrawal && loan.occurence !== 'weekly') {
          
          errors.push({ 
            error: true, 
            message: `Clients can only withdraw excess over ₱1,000 MCBU balance. Maximum allowed: ₱${maxMcbuWithdrawal}`,
            withdrawal
          });
          return false;
        }
      }
    }
    
    // Validate CSF withdrawal amount (only for group leaders)
    if (csfAmount > 0) {
      const currentCsf = parseFloat(loan.csf) || 0;
      if (csfAmount > currentCsf) {
        errors.push({ 
          error: true, 
          message: `CSF withdrawal amount (${csfAmount}) exceeds available balance (${currentCsf})`, 
          withdrawal 
        });
        return false;
      }
      
      if (!withdrawal.group_leader) {
        errors.push({ 
          error: true, 
          message: `CSF withdrawal is only allowed for group leaders`, 
          withdrawal 
        });
        return false;
      }
    }
    return { withdrawal, loan, group };
}