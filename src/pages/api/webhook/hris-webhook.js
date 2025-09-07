import { apiHandler } from "@/services/api-handler";
import {
  insertBranch,
  insertDivision,
  insertEmployee,
  insertOrUpdateArea,
  insertRegion,
  updateBranch,
  updateDivision,
  updateEmployee,
  updateRegion,
} from "@/pages/api/webhook/hris-webhook-handlers";

const handlers = {
  branches: {
    insert: insertBranch,
    update: updateBranch,
  },
  areas: {
    insert: insertOrUpdateArea,
    update: insertOrUpdateArea,
  },
  regions: {
    insert: insertRegion,
    update: updateRegion,
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
  
  await handler(payload.event.data.new);
  res.status(201).end();
}
