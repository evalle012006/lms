import { apiHandler } from "@/services/api-handler";
import {
  insertDivision,
  insertEmployee,
  insertOrUpdateArea,
  insertOrUpdateBranch,
  insertOrUpdateRegion,
  updateDivision,
  updateEmployee,
} from "@/pages/api/webhook/hris-webhook-handlers";

const handlers = {
  branches: {
    insert: insertOrUpdateBranch,
    update: insertOrUpdateBranch,
  },
  areas: {
    insert: insertOrUpdateArea,
    update: insertOrUpdateArea,
  },
  regions: {
    insert: insertOrUpdateRegion,
    update: insertOrUpdateRegion,
  },
  division: {
    insert: insertDivision,
    update: updateDivision,
  },
  employees: {
    insert: insertEmployee,
    update: updateEmployee,
  },
};

export default apiHandler({
  post: update,
});

async function update(req, res) {
  console.log('Received webhook event:', req.body)
  
  const payload = req.body;
  const handler = handlers[payload.table.name]?.[payload.event.op.toLowerCase()];
  if (!handler) {
    return res.status(400).end({message: `No webhook handler found for table=${payload.table.name} and event=${payload.event.op}`});
  }
  
  try {
    await handler(payload.event.data.new);
    res.status(201).end();
  } catch (error) {
    console.error('Error processing webhook event:', error);
    throw error;
  }
}
