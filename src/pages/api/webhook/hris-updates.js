import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";

const handlers = {
  branches: {
    insert: insertBranch,
    update: updateBranch,
  },
  areas: {
    insert: insertArea,
    update: updateArea,
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
    createGraphType('branches', '_id')(),
    {
      objects: [{
        _id: branch.id,
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
    createGraphType('branches', '_id')(),
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

function insertArea(area) {
  console.log(`Inserting area ${area.id} ${area.name}`)
  return graph.mutation(insertQl(
    createGraphType('areas', '_id')(),
    {
      objects: [{
        _id: area.id,
        branchIds: [], // TODO: check with donie if still needed
        dateAdded: area.create_date,
        dateModified: area.modify_date,
        managerIds: [], // TODO: 
        name: area.name,
        regionId: area.region_id,
        divisionId: area.division_id,
        hrisId: area.id,
      }]
    }
  ))
}

function updateArea(area) {
  console.log(`Updating area ${area.id} ${area.name}`)
  return graph.mutation(updateQl(
    createGraphType('branches', '_id')(),
    {
      set: {
        branchIds: [], // TODO: check with donie if still needed
        managerIds: [], // TODO: 
        name: area.name,
        regionId: area.region_id,
        divisionId: area.division_id,
        dateModified: area.modify_date,
      },
      where: { hrisId: area.id }
    }
  ))
}

function insertRegion(region) {
  console.log(`Inserting region ${region.id} ${region.name}`)
  return graph.mutation(insertQl(
    createGraphType('regions', '_id')(),
    {
      objects: [{
        _id: region.id,
        areaIds: [], // TODO: check if still needed
        dateAdded: region.create_date,
        dateModified: region.modify_date,
        managerIds: [], // TODO:
        name: region.name,
        divisionId: region.division_id,
        hrisId: region.id,
      }]
    }
  ))
}

function updateRegion(region) {
  console.log(`Updating region ${region.id} ${region.name}`)
  return graph.mutation(updateQl(
    createGraphType('regions', '_id')(),
    {
      set: {
        areaIds: [], // TODO: check if still needed
        managerIds: [], // TODO:
        name: region.name,
        divisionId: region.division_id,
        dateModified: region.modify_date,
      },
      where: { hrisId: region.id }
    }
  ))
}

function insertDivision(division) {
  console.log(`Inserting division ${division.id} ${division.name}`)
  return graph.mutation(insertQl(
    createGraphType('divisions', '_id')(),
    {
      objects: [{
        _id: division.id,
        name: division.name,
        managerIds: [], // TODO:
        regionIds: [], // TODO:
        dateAdded: division.create_date,
        dateModified: division.modify_date,
        hrisId: division.id,
      }]
    }
  ))
}

function updateDivision(division) {
  console.log(`Updating region ${division.id} ${division.name}`)
  return graph.mutation(updateQl(
    createGraphType('regions', '_id')(),
    {
      set: {
        name: division.name,
        managerIds: [], // TODO:
        regionIds: [], // TODO:
        dateModified: division.modify_date,
      },
      where: { hrisId: division.id }
    }
  ))
}

async function insertEmployee(employee) {
  // TODO: how to reconcile users
}

async function updateEmployee(employee) {
  // TODO: how to reconcile users
}

