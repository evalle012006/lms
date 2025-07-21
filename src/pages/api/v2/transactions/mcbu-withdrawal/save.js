import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { insertQl, createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS, LOAN_FIELDS } from "@/lib/graph.fields";
import { filterGraphFields } from '@/lib/graph.functions';
import { generateUUID } from '@/lib/utils';
import logger from '@/logger';

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
    
    if (!mcbu_withdrawal_amount || mcbu_withdrawal_amount <= 0) {
      return res.status(400).json({
        error: true,
        message: "MCBU withdrawal amount is required and must be greater than 0"
      });
    }
    
    // Validate CSF withdrawal amount if provided
    const csfAmount = parseFloat(csf_withdrawal_amount) || 0;
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
    const mcbuAmount = parseFloat(mcbu_withdrawal_amount);
    const currentMcbu = parseFloat(loan.mcbu) || 0;
    
    if (mcbuAmount > currentMcbu) {
      return res.status(400).json({
        error: true,
        message: `MCBU withdrawal amount (${mcbuAmount}) exceeds available balance (${currentMcbu})`
      });
    }
    
    // Validate CSF withdrawal amount against available balance
    if (csfAmount > 0) {
      const currentCsf = parseFloat(loan.csf) || 0;
      if (csfAmount > currentCsf) {
        return res.status(400).json({
          error: true,
          message: `CSF withdrawal amount (${csfAmount}) exceeds available balance (${currentCsf})`
        });
      }
    }
    
    // Additional business logic validation for MCBU
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
      if (mcbuAmount > maxMcbuWithdrawal) {
        return res.status(400).json({
          error: true,
          message: `Clients can only withdraw excess over ₱1,000 MCBU balance. Maximum allowed: ₱${maxMcbuWithdrawal}`
        });
      }
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