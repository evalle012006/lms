import {
  createGraphType,
  insertQl,
  queryQl,
  updateQl,
} from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  fetchFromHris,
  hrisBranchIdsToLmsBranchIds,
  hrisUserIdsToLmsUserIds,
} from "@/pages/api/webhook/hris-webhook-handlers/common";

const graph = new GraphProvider();
const areaGraphType = createGraphType("areas", "_id")();

export async function insertOrUpdateArea(area) {
  console.log(`Syncing updates from HRIS for area ${area.id} ${area.name}`);
  if (area.name.match(/exit\s+staff/i)) {
    console.log(`Skipping Exit Staff area.`);
    return;
  }

  console.log(`Fetching full area info ${area.id} ${area.name} from HRIS to insert`);
  const hrisAreaFullInfo = await fetchFromHris(`areas/${area.id}`)
    .then((data) => data.area);

  const savedArea = await graph.query(queryQl(areaGraphType, { where: { hrisId: { _eq: area.id } } }));

  if (savedArea.data?.areas?.length) {
    await updateArea(hrisAreaFullInfo);
  } else {
    await insertArea(hrisAreaFullInfo);
  }
  
  console.log(`Done syncing updates from HRIS for area ${area.id} ${area.name}`);
}

async function insertArea(hrisAreaFullInfo) {
  console.log(`Inserting area ${hrisAreaFullInfo.id} ${hrisAreaFullInfo.name} from HRIS`);
  
  return graph.mutation(
    insertQl(createGraphType("areas", "_id")(), {
      objects: [
        {
          _id: hrisAreaFullInfo.id,
          branchIds: await resolveLmsBranchIds(hrisAreaFullInfo),
          dateAdded: hrisAreaFullInfo.create_date,
          dateModified: hrisAreaFullInfo.modify_date,
          managerIds: await resolveLmsUserIds(hrisAreaFullInfo),
          name: hrisAreaFullInfo.name,
          regionId: hrisAreaFullInfo.region_id,
          divisionId: hrisAreaFullInfo.division_id,
          hrisId: hrisAreaFullInfo.id,
        },
      ],
    })
  );
}

async function updateArea(hrisAreaFullInfo) {
  console.log(`Updating area ${hrisAreaFullInfo.id} ${hrisAreaFullInfo.name} from HRIS`);
  
  return graph.mutation(
    updateQl(createGraphType("areas", "_id")(), {
      set: {
        branchIds: await resolveLmsBranchIds(hrisAreaFullInfo),
        dateModified: hrisAreaFullInfo.modify_date,
        managerIds: await resolveLmsUserIds(hrisAreaFullInfo),
        name: hrisAreaFullInfo.name,
        regionId: hrisAreaFullInfo.region_id,
        divisionId: hrisAreaFullInfo.division_id,
      },
      where: { hrisId: { _eq: hrisAreaFullInfo.id } },
    })
  );
}

async function resolveLmsBranchIds(hrisAreaFullInfo) {
  const hrisBranchIds = hrisAreaFullInfo.branches?.map((b) => b.id) ?? [];
  const lmsIds = await hrisBranchIdsToLmsBranchIds(hrisBranchIds);
  return JSON.stringify(lmsIds);
}

async function resolveLmsUserIds(hrisAreaFullInfo) {
  const hrisUserIds = hrisAreaFullInfo.managers?.map((m) => m.employee_id) ?? []
  const lmsIds = await hrisUserIdsToLmsUserIds(hrisUserIds);
  return JSON.stringify(lmsIds);
}