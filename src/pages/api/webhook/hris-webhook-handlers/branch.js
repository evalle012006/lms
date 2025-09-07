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
        hrisId: branch.id,
        ...(await resolveLmsReferences(branch)),
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
        dateModified: branch.modify_date,
        ...(await resolveLmsReferences(branch)),
      },
      where: { hrisId: { _eq: branch.id } }
    }
  ))
}

async function resolveLmsReferences(branch) {
  const [areaId, regionId, divisionId] = await Promise.all([
    branch.area_id ? hrisAreaIdsToLmsAreaIds([branch.area_id]).then(ids => ids?.[0]) : null,
    branch.region_id ? hrisRegionIdsToLmsRegionIds([branch.region_id]).then(ids => ids?.[0]) : null,
    branch.division_id ? hrisDivisionIdsToLmsDivisionIds([branch.division_id]).then(ids => ids?.[0]) : null,
  ]);
  
  return { areaId, regionId, divisionId };
}