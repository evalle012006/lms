// transactions/mcbu-withdrawal.js
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, queryQl, updateQl } from "@/lib/graph/graph.util";
import { createMcbuWithdrawalsTypes, mcbuWithdrawalList, toMcbuWithdrawalDto } from "./common";

const graph = new GraphProvider();

const MCUBU_WITHDRAWAL_TYPE = createGraphType('mcbu_withdrawals', '_id')('result');

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const { _id, ...data } = req.body;
  
  try {
    // If _id exists, update the existing record
    if (_id) {
      // Remove any undefined fields
      const updateData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      const result = await graph.mutation(
        updateQl(MCUBU_WITHDRAWAL_TYPE, {
          set: updateData,
          where: { _id: { _eq: _id ?? null } }
        }),
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
    } 
    // Otherwise insert a new record
    else {
      // Add insertion timestamp and other defaults
      const insertData = {
        ...data,
        inserted_date: new Date().toISOString(),
        status: data.status || "pending"
      };
      
      const result = await graph.mutation(
        insertQl(MCUBU_WITHDRAWAL_TYPE, {
          objects: [ insertData ]
        }),
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
    }
  } catch (error) {
    console.error("Error saving MCBU withdrawal:", error);
    return res.status(500).json({
      error: true,
      message: "Failed to save MCBU withdrawal"
    });
  }
}