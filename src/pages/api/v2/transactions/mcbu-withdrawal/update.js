// transactions/mcbu-withdrawal/update.js
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { mutationQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

export default apiHandler({
  post: update,
});

async function update(req, res) {
  const { _id, ...data } = req.body;
  
  if (!_id) {
    return res.status(400).json({
      error: true,
      message: "MCBU Withdrawal ID is required for updating"
    });
  }
  
  try {
    // Remove any undefined fields
    const updateData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
    
    const result = await graph.mutation(
      mutationQl("update_mcbu_withdrawals_by_pk", {
        pk_columns: { _id },
        _set: updateData
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
      data: result.data.update_mcbu_withdrawals_by_pk
    });
  } catch (error) {
    console.error("Error updating MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to update MCBU withdrawal"
    });
  }
}