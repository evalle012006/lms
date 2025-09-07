import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";

const graph = new GraphProvider();

export function insertBranch(branch) {
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

export function updateBranch(branch) {
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