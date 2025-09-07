import {
  createGraphType,
  insertQl,
  queryQl,
  updateQl,
} from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  hrisAreaIdsToLmsAreaIds,
  hrisDivisionIdsToLmsDivisionIds,
  hrisRegionIdsToLmsRegionIds,
} from "@/pages/api/webhook/hris-webhook-handlers/common";

const graph = new GraphProvider();
const branchGraphType = createGraphType("branches", "_id")();

export async function insertOrUpdateBranch(branch) {
  console.log(`Syncing updates from HRIS for branch ${branch.id} ${branch.code} ${branch.name}`);
  if (branch.name.match(/exit\s+staff/i)) {
    console.log(`Skipping Exit Staff branch.`);
    return;
  }

  const savedBranch = await graph.query(queryQl(branchGraphType, { where: { hrisId: { _eq: branch.id } } }));
  if (savedBranch.data?.branches?.length) {
    await updateBranch(branch);
  } else {
    await insertBranch(branch);
  }
  
  console.log(`Done syncing updates from HRIS for branch ${branch.id} ${branch.code} ${branch.name}`);
}

async function insertBranch(branch) {
  console.log(`Inserting branch ${branch.id} ${branch.code}`)
  return graph.mutation(insertQl(
    branchGraphType,
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
        areaId: branch.area_id ? await hrisAreaIdsToLmsAreaIds([branch.area_id]).then(ids => ids?.[0]) : null,
        regionId: branch.region_id ? await hrisRegionIdsToLmsRegionIds([branch.region_id]).then(ids => ids?.[0]) : null,
        divisionId: branch.division_id ? await hrisDivisionIdsToLmsDivisionIds([branch.division_id]).then(ids => ids?.[0]) : null,
        hrisId: branch.id,
      }]
    }
  ));
}

async function updateBranch(branch) {
  console.log(`Updating branch ${branch.id} ${branch.code}`)
  return graph.mutation(updateQl(
    branchGraphType,
    {
      set: {
        address: branch.address,
        code: branch.code,
        email: branch.email,
        name: branch.name,
        phoneNumber: branch.contact_number,
        areaId: branch.area_id ? await hrisAreaIdsToLmsAreaIds([branch.area_id]).then(ids => ids?.[0]) : null,
        regionId: branch.region_id ? await hrisRegionIdsToLmsRegionIds([branch.region_id]).then(ids => ids?.[0]) : null,
        divisionId: branch.division_id ? await hrisDivisionIdsToLmsDivisionIds([branch.division_id]).then(ids => ids?.[0]) : null,
        dateModified: branch.modify_date,
      },
      where: { hrisId: { _eq: branch.id } }
    }
  ))
}