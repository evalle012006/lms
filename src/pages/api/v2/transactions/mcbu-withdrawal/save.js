import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { insertQl, createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS, LOAN_FIELDS } from "@/lib/graph.fields";
import { filterGraphFields } from '@/lib/graph.functions';
import { generateUUID } from '@/lib/utils';
import logger from '@/logger';
import { isNotificationEnabled, notifyWithdrawal } from '@/lib/notification-service';
import { findUserById, findBranches, findClients } from '@/lib/graph.functions';
import { getMcbuWithdrawRetainConfig, validateMcbuRetain } from "@/lib/mcbu-withdrawal-utils";

const graph = new GraphProvider();

// Create the type definitions
const mcbuWithdrawalsType = createGraphType(
  "mcbu_withdrawals",
  MCBU_WITHDRAWAL_FIELDS
);

const loansType = createGraphType('loans', LOAN_FIELDS);

export default apiHandler({
  post: save,
});

/**
 * Create notification for MCBU or CSF withdrawal
 * @param {Object} params - Withdrawal parameters
 */
async function createWithdrawalNotification({
    client_id,
    loan_id,
    branch_id,
    group_id,
    lo_id,
    division_id,
    region_id,
    area_id,
    mcbuAmount,
    csfAmount,
    user_id
}) {
    try {
        const user = await findUserById(user_id);
        const branches = await findBranches({ _id: { _eq: branch_id } });
        const clients = await findClients({ _id: { _eq: client_id } });
        const branch = branches?.[0];
        const client = clients?.[0];

        if (branch && client) {
            const clientName = client.fullName || `${client.firstName} ${client.lastName}`;
            
            // Notify for MCBU withdrawal if amount > 0
            if (mcbuAmount > 0) {
                const retainConfig = await getMcbuWithdrawRetainConfig();
                const retainCheck = validateMcbuRetain(mcbuAmount, currentMcbu, group_leader, loan.occurence, retainConfig);
                if (!retainCheck.valid) {
                    return res.status(200).json({ success: false, message: retainCheck.message });
                }
            }
            
            // Notify for CSF withdrawal if amount > 0
            if (csfAmount > 0) {
                await notifyWithdrawal({
                    clientName,
                    clientId: client_id,
                    loanId: loan_id,
                    amount: csfAmount,
                    groupId: group_id,
                    branchId: branch_id,
                    areaId: branch.areaId || area_id,
                    regionId: branch.regionId || region_id,
                    divisionId: branch.divisionId || division_id,
                    loId: lo_id,
                    createdBy: user?._id || user_id,
                    createdByName: user ? `${user.firstName} ${user.lastName}` : 'System',
                    isCsf: true
                });
                
                logger.debug({
                    user_id,
                    page: 'MCBU Withdrawal Save',
                    message: 'Notification created for CSF withdrawal',
                    amount: csfAmount,
                    clientId: client_id
                });
            }
        }
    } catch (error) {
        logger.error({
            user_id,
            page: 'MCBU Withdrawal Save',
            message: 'Failed to create withdrawal notification',
            error: error.message
        });
    }
}

async function save(req, res) {
  try {
    const user_id = req?.auth?.sub;
    
    const { 
      loan_id, 
      branch_id,
      lo_id,
      group_id,
      client_id,
      mcbu_withdrawal_amount, 
      csf_withdrawal_amount, // Add CSF withdrawal field
      inserted_date,
      inserted_by,
      status,
      division_id,
      region_id,
      area_id,
      group_leader
    } = req.body;
    
    // Validate required fields
    if (!loan_id) {
      return res.status(400).json({
        error: true,
        message: "Loan ID is required"
      });
    }
    
    // Parse withdrawal amounts
    const mcbuAmount = parseFloat(mcbu_withdrawal_amount) || 0;
    const csfAmount = parseFloat(csf_withdrawal_amount) || 0;

    const isNotificationEnabledFlag = await isNotificationEnabled();
    
    // Updated validation: Allow MCBU to be 0 if group leader has CSF withdrawal > 0
    if (mcbuAmount <= 0 && (!group_leader || (group_leader && csfAmount <= 0))) {
      return res.status(400).json({
        error: true,
        message: "At least one withdrawal amount (MCBU or CSF) must be greater than 0"
      });
    }
    
    // Validate CSF withdrawal amount if provided
    if (csfAmount > 0 && !group_leader) {
      return res.status(400).json({
        error: true,
        message: "CSF withdrawal is only allowed for group leaders"
      });
    }
    
    // Get loan information for validation
    const loanResponse = await graph.query(
      queryQl(loansType(), {
        where: { _id: { _eq: loan_id } }
      })
    );
    
    const loan = loanResponse.data?.loans?.[0];
    
    if (!loan) {
      return res.status(400).json({
        error: true,
        message: "Loan not found"
      });
    }
    
    // Validate MCBU withdrawal amount against available balance
    const currentMcbu = parseFloat(loan.mcbu) || 0;
    const currentCsf = parseFloat(loan.csf) || 0;
    
    if (mcbuAmount > currentMcbu) {
      return res.status(400).json({
        error: true,
        message: `MCBU withdrawal amount (${mcbuAmount}) exceeds available balance (${currentMcbu})`
      });
    }
    
    // Validate CSF withdrawal amount against available balance
    if (csfAmount > currentCsf && group_leader) {
      return res.status(400).json({
        error: true,
        message: `CSF withdrawal amount (${csfAmount}) exceeds available balance (${currentCsf})`
      });
    }
    
    // Additional business logic validation for MCBU
    if (mcbuAmount > 0) { // Only validate MCBU limits if amount > 0
      // Group leaders: can only withdraw excess over 3000
      // Regular clients (daily): can only withdraw excess over 1000
      if (group_leader) {
        const maxMcbuWithdrawal = Math.max(0, currentMcbu - 3000);
        if (mcbuAmount > maxMcbuWithdrawal) {
          return res.status(400).json({
            error: true,
            message: `Group leaders can only withdraw excess over ₱3,000 MCBU balance. Maximum allowed: ₱${maxMcbuWithdrawal}`
          });
        }
      } else {
        // Assuming daily occurrence for regular clients - this could be enhanced with actual occurrence check
        const maxMcbuWithdrawal = Math.max(0, currentMcbu - 1000);
        if (mcbuAmount > maxMcbuWithdrawal && loan.occurence !== 'weekly') {
          return res.status(400).json({
            error: true,
            message: `Clients can only withdraw excess over ₱1,000 MCBU balance. Maximum allowed: ₱${maxMcbuWithdrawal}`
          });
        }
      }
    }

    // Check for existing pending/approved withdrawals
    const existingWithdrawals = await graph.query(
      queryQl(mcbuWithdrawalsType(), {
        where: {
          loan_id: { _eq: loan_id },
          status: { _in: ['pending', 'approved'] },
          inserted_date: { _eq: inserted_date }
        }
      })
    );

    if (existingWithdrawals.data && existingWithdrawals.data.mcbu_withdrawals && existingWithdrawals.data.mcbu_withdrawals.length > 0) {
      return res.status(400).json({
        error: true,
        message: "There are existing approved or pending withdrawals for this loan."
      });
    }

    // Prepare withdrawal data
    const withdrawalData = {
      _id: generateUUID(),
      loan_id,
      branch_id,
      lo_id,
      group_id,
      client_id,
      mcbu_withdrawal_amount: mcbuAmount,
      csf_withdrawal_amount: csfAmount,
      status: status || 'pending',
      inserted_date: inserted_date || new Date().toISOString().split('T')[0],
      inserted_by: inserted_by || user_id,
      division_id,
      region_id,
      area_id,
      group_leader: group_leader || false
    };
    
    logger.debug({
      user_id, 
      page: `Saving MCBU Withdrawal`, 
      data: withdrawalData
    });
    
    // Insert the withdrawal record
    const result = await graph.mutation(
      insertQl(mcbuWithdrawalsType(), { 
        objects: [filterGraphFields(MCBU_WITHDRAWAL_FIELDS, withdrawalData)]
      })
    );
    
    if (result.errors) {
      return res.status(400).json({
        error: true,
        message: result.errors[0].message
      });
    }
    
    const savedWithdrawal = result.data.mcbu_withdrawals.returning[0];
    if (isNotificationEnabledFlag) {
      try {
          await createWithdrawalNotification({
              client_id,
              loan_id,
              branch_id,
              group_id,
              lo_id,
              division_id,
              region_id,
              area_id,
              mcbuAmount,
              csfAmount,
              user_id
          });
      } catch (notifError) {
          logger.error({
              user_id,
              page: 'MCBU Withdrawal Save',
              message: 'Failed to create withdrawal notification',
              error: notifError.message
          });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "MCBU Withdrawal successfully saved",
      data: savedWithdrawal,
      summary: {
        mcbu_withdrawal_amount: mcbuAmount,
        csf_withdrawal_amount: csfAmount,
        total_withdrawal_value: mcbuAmount + csfAmount,
        group_leader: group_leader || false
      }
    });
    
  } catch (error) {
    console.error("Error saving MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to save MCBU withdrawal: " + error.message
    });
  }
}