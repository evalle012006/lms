import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { insertQl, createGraphType } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS } from "@/lib/graph.fields";
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();

// Use your existing constant with createGraphType
const mcbuWithdrawalsType = createGraphType(
  "mcbu_withdrawals",
  MCBU_WITHDRAWAL_FIELDS
);

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const data = req.body;
  
  try {
    // Add insertion timestamp and other defaults
    const insertData = {
        _id: generateUUID(),
        ...data,
        inserted_date: new Date().toISOString(),
        status: data.status || "pending"
    };
    
    // Use the insertQl function to create the mutation
    const result = await graph.mutation(
      insertQl(mcbuWithdrawalsType(), { 
        objects: insertData 
      })
    );
    
    if (result.errors) {
      return res.status(400).json({
        error: true,
        message: result.errors[0].message
      });
    }
    
    // Access the returning data correctly based on the schema
    return res.status(201).json({
      success: true,
      message: "MCBU Withdrawal created successfully",
      data: result.data.mcbu_withdrawals.returning[0]
    });
  } catch (error) {
    console.error("Error saving MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to save MCBU withdrawal: " + error.message
    });
  }
}