import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";

const handlers = {
  branches: {
    insert: insertBranch,
    update: updateBranch,
  },
  employees: {
    insert: insertEmployee,
    update: updateEmployee,
  }
}

export default apiHandler({
  post: update,
});

const graph = new GraphProvider();

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

function insertBranch(branch) {
  console.log(`Inserting branch ${branch.id} ${branch.code}`)
  return graph.mutation(insertQl(
    createGraphType('branches', 'id')(),
    {
      objects: [{
        id: branch.id,
        address: branch.address,
        code: branch.code,
        dateAdded: branch.create_date,
        dateModified: branch.modify_date,
        email: branch.email,
        name: branch.name,
        phoneNumber: branch.contact_number,
        areaId: branch.area_id,
        regionId: branch.region_id,
        divisionId: branch.division_id,
        hrisId: branch.id,
      }]
    }
  ))
}

function updateBranch(branch) {
  console.log(`Updating branch ${branch.id} ${branch.code}`)
  return graph.mutation(updateQl(
    createGraphType('branches', 'id')(),
    {
      set: {
        address: branch.address,
        code: branch.code,
        email: branch.email,
        name: branch.name,
        phoneNumber: branch.contact_number,
        areaId: branch.area_id,
        regionId: branch.region_id,
        divisionId: branch.division_id,
        dateModified: branch.modify_date,
      },
      where: { hrisId: branch.id }
    }
  ))
}

function insertEmployee(employee) {
  
}

function updateEmployee(employee) {
  
}

