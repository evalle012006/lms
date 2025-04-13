import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { updateQl, createGraphType } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS } from "@/lib/graph.fields";

const graph = new GraphProvider();

// Create the type definition
const mcbuWithdrawalsType = createGraphType(
  "mcbu_withdrawals",
  MCBU_WITHDRAWAL_FIELDS
);

export default apiHandler({
  post: update,
});

async function update(req, res) {
  const { _id, modifiedBy, modifiedDate, ...otherData } = req.body;
  
  if (!_id) {
    return res.status(400).json({
      error: true,
      message: "MCBU Withdrawal ID is required for updating"
    });
  }
  
  try {
    // Convert camelCase to snake_case for modified fields
    const updateData = {
      ...otherData,
      modified_by: modifiedBy,  // Convert modifiedBy to modified_by
      modified_date: modifiedDate // Convert modifiedDate to modified_date
    };
    
    // Remove any undefined fields
    const cleanedData = Object.entries(updateData).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
    
    // Use the updateQl function to create the mutation
    const result = await graph.mutation(
      updateQl(mcbuWithdrawalsType(), {
        where: { _id: { _eq: _id } },
        set: cleanedData
      })
    );
    
    if (result.errors) {
      return res.status(400).json({
        error: true,
        message: result.errors[0].message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "MCBU Withdrawal updated successfully",
      data: result.data.mcbu_withdrawals.returning[0]
    });
  } catch (error) {
    console.error("Error updating MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to update MCBU withdrawal: " + error.message
    });
  }
}