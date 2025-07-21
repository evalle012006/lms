import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { updateQl, createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS, LOAN_FIELDS } from "@/lib/graph.fields";
import { filterGraphFields } from '@/lib/graph.functions';
import logger from '@/logger';

const graph = new GraphProvider();

// Create the type definitions
const mcbuWithdrawalsType = createGraphType(
  "mcbu_withdrawals",
  MCBU_WITHDRAWAL_FIELDS
);

const loansType = createGraphType('loans', LOAN_FIELDS);

export default apiHandler({
  post: update,
});

async function update(req, res) {
  try {
    const user_id = req?.auth?.sub;
    
    const { 
      _id, 
      loan_id,
      mcbu_withdrawal_amount, 
      csf_withdrawal_amount, // Add CSF withdrawal field
      modifiedBy, 
      modifiedDate,
      group_leader,
      ...otherData 
    } = req.body;
    
    if (!_id) {
      return res.status(400).json({
        error: true,
        message: "MCBU Withdrawal ID is required for updating"
      });
    }
    
    // Get existing withdrawal record
    const existingWithdrawalResponse = await graph.query(
      queryQl(mcbuWithdrawalsType(), {
        where: { _id: { _eq: _id } }
      })
    );
    
    const existingWithdrawal = existingWithdrawalResponse.data?.mcbu_withdrawals?.[0];
    
    if (!existingWithdrawal) {
      return res.status(404).json({
        error: true,
        message: "MCBU Withdrawal not found"
      });
    }
    
    // Only allow updates for pending withdrawals
    if (existingWithdrawal.status !== 'pending') {
      return res.status(400).json({
        error: true,
        message: "Only pending withdrawals can be updated"
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
    
    // Get loan information for validation (if amounts are being changed)
    if (mcbu_withdrawal_amount || csf_withdrawal_amount) {
      const loanResponse = await graph.query(
        queryQl(loansType(), {
          where: { _id: { _eq: loan_id || existingWithdrawal.loan_id } }
        })
      );
      
      const loan = loanResponse.data?.loans?.[0];
      
      if (!loan) {
        return res.status(400).json({
          error: true,
          message: "Associated loan not found"
        });
      }
      
      // Validate MCBU withdrawal amount if being updated
      if (mcbu_withdrawal_amount) {
        const mcbuAmount = parseFloat(mcbu_withdrawal_amount);
        const currentMcbu = parseFloat(loan.mcbu) || 0;
        
        if (mcbuAmount <= 0) {
          return res.status(400).json({
            error: true,
            message: "MCBU withdrawal amount must be greater than 0"
          });
        }
        
        if (mcbuAmount > currentMcbu) {
          return res.status(400).json({
            error: true,
            message: `MCBU withdrawal amount (${mcbuAmount}) exceeds available balance (${currentMcbu})`
          });
        }
        
        // Apply business rules for maximum withdrawal
        if (group_leader) {
          const maxMcbuWithdrawal = Math.max(0, currentMcbu - 3000);
          if (mcbuAmount > maxMcbuWithdrawal) {
            return res.status(400).json({
              error: true,
              message: `Group leaders can only withdraw excess over ₱3,000 MCBU balance. Maximum allowed: ₱${maxMcbuWithdrawal}`
            });
          }
        } else {
          const maxMcbuWithdrawal = Math.max(0, currentMcbu - 1000);
          if (mcbuAmount > maxMcbuWithdrawal) {
            return res.status(400).json({
              error: true,
              message: `Clients can only withdraw excess over ₱1,000 MCBU balance. Maximum allowed: ₱${maxMcbuWithdrawal}`
            });
          }
        }
      }
      
      // Validate CSF withdrawal amount if being updated
      if (csfAmount > 0) {
        const currentCsf = parseFloat(loan.csf) || 0;
        if (csfAmount > currentCsf) {
          return res.status(400).json({
            error: true,
            message: `CSF withdrawal amount (${csfAmount}) exceeds available balance (${currentCsf})`
          });
        }
      }
    }
    
    // Prepare update data
    const updateData = {
      ...otherData,
      modified_by: modifiedBy || user_id,  // Convert modifiedBy to modified_by
      modified_date: modifiedDate || new Date().toISOString() // Convert modifiedDate to modified_date
    };
    
    // Include withdrawal amounts if provided
    if (mcbu_withdrawal_amount !== undefined) {
      updateData.mcbu_withdrawal_amount = parseFloat(mcbu_withdrawal_amount);
    }
    
    if (csf_withdrawal_amount !== undefined) {
      updateData.csf_withdrawal_amount = parseFloat(csf_withdrawal_amount) || 0;
    }
    
    if (group_leader !== undefined) {
      updateData.group_leader = group_leader;
    }
    
    // Remove any undefined fields
    const cleanedData = Object.entries(updateData).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {});
    
    logger.debug({
      user_id, 
      page: `Updating MCBU Withdrawal: ${_id}`, 
      data: cleanedData
    });
    
    // Execute the update query
    const result = await graph.mutation(
      updateQl(mcbuWithdrawalsType(), {
        where: { _id: { _eq: _id } },
        set: filterGraphFields(MCBU_WITHDRAWAL_FIELDS, cleanedData)
      })
    );
    
    if (result.errors) {
      return res.status(400).json({
        error: true,
        message: result.errors[0].message
      });
    }
    
    const updatedWithdrawal = result.data.mcbu_withdrawals.returning[0];
    
    if (!updatedWithdrawal) {
      return res.status(404).json({
        error: true,
        message: "Withdrawal not found or not updated"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "MCBU Withdrawal updated successfully",
      data: updatedWithdrawal,
      summary: {
        mcbu_withdrawal_amount: updatedWithdrawal.mcbu_withdrawal_amount,
        csf_withdrawal_amount: updatedWithdrawal.csf_withdrawal_amount || 0,
        total_withdrawal_value: (updatedWithdrawal.mcbu_withdrawal_amount || 0) + (updatedWithdrawal.csf_withdrawal_amount || 0),
        group_leader: updatedWithdrawal.group_leader || false,
        status: updatedWithdrawal.status
      }
    });
    
  } catch (error) {
    console.error("Error updating MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to update MCBU withdrawal: " + error.message
    });
  }
}