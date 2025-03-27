// transactions/mcbu-withdrawal/bulk-approve.js
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { updateQl, createGraphType } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS } from "@/lib/graph.fields";

const graph = new GraphProvider();
const mcbuWithdrawalsType = createGraphType(
  "mcbu_withdrawals",
  MCBU_WITHDRAWAL_FIELDS
);

export default apiHandler({
  post: bulkApprove,
});

async function bulkApprove(req, res) {
  try {
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
      const { id, modified_by, modified_date } = withdrawal;
      
      if (!id) {
        errors.push({ error: true, message: "Withdrawal ID is required", withdrawal });
        continue;
      }
      
      try {
        // Set up the update data
        const updateData = {
          status: 'approved',
          approved_date: new Date().toISOString(),
          modified_by: modified_by,
          modified_date: modified_date || new Date().toISOString()
        };
        
        // Execute update query
        const result = await graph.mutation(
          updateQl(mcbuWithdrawalsType(), {
            where: { _id: { _eq: id } },
            set: updateData
          })
        );
        
        if (result.errors) {
          errors.push({ 
            error: true, 
            message: result.errors[0].message, 
            withdrawal 
          });
        } else {
          // Check if any records were updated
          if (result.data.mcbu_withdrawals.returning.length > 0) {
            results.push({
              success: true,
              id,
              data: result.data.mcbu_withdrawals.returning[0]
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