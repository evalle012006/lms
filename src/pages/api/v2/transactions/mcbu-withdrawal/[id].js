import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { deleteQl, createGraphType } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS } from "@/lib/graph.fields";

const graph = new GraphProvider();

// Create the type definition
const mcbuWithdrawalsType = createGraphType(
  "mcbu_withdrawals",
  MCBU_WITHDRAWAL_FIELDS
);

export default apiHandler({
  delete: remove
});

async function remove(req, res) {
  // Get the ID from the URL parameter
  const id = req.query.id;
  
  if (!id) {
    return res.status(400).json({
      error: true,
      message: "MCBU Withdrawal ID is required for deletion"
    });
  }
  
  try {
    // Use the deleteQl function to create the delete mutation
    const result = await graph.mutation(
      deleteQl(mcbuWithdrawalsType(), { 
        _id: { _eq: id } 
      })
    );
    
    if (result.errors) {
      return res.status(400).json({
        error: true,
        message: result.errors[0].message
      });
    }
    
    console.log("Deleted MCBU withdrawal:", result.data);
    // Check if any records were deleted
    if (result.data.mcbu_withdrawals.returning.length === 0) {
      return res.status(404).json({
        error: true,
        message: "MCBU Withdrawal not found"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "MCBU Withdrawal deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to delete MCBU withdrawal: " + error.message
    });
  }
}