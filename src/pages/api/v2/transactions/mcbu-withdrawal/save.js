// transactions/mcbu-withdrawal/save.js
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { mutationQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const data = req.body;
  
  try {
    // Add insertion timestamp and other defaults
    const insertData = {
      ...data,
      inserted_date: new Date().toISOString(),
      status: data.status || "pending"
    };
    
    const result = await graph.mutation(
      mutationQl("insert_mcbu_withdrawals_one", {
        object: insertData
      })
    );
    
    if (result.errors) {
      return res.status(400).json({
        error: true,
        message: result.errors[0].message
      });
    }
    
    return res.status(201).json({
      success: true,
      message: "MCBU Withdrawal created successfully",
      data: result.data.insert_mcbu_withdrawals_one
    });
  } catch (error) {
    console.error("Error saving MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to save MCBU withdrawal"
    });
  }
}