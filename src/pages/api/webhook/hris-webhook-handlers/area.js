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

async function insertArea(area) {
  console.log(`Inserting area ${area.id} ${area.name} from HRIS`);
  return graph.mutation(
    insertQl(createGraphType("areas", "_id")(), {
      objects: [
        {
          _id: area.id,
          dateAdded: area.create_date,
          dateModified: area.modify_date,
          name: area.name,
          regionId: area.region_id,
          divisionId: area.division_id,
          hrisId: area.id,
          ...(await resolveLmsReferences(area)),
        },
      ],
    })
  );
}

async function updateArea(area) {
  console.log(`Updating area ${area.id} ${area.name} from HRIS`);
  return graph.mutation(
    updateQl(createGraphType("areas", "_id")(), {
      set: {
        dateModified: area.modify_date,
        name: area.name,
        regionId: area.region_id,
        divisionId: area.division_id,
        ...(await resolveLmsReferences(area)),
      },
      where: { hrisId: { _eq: area.id } },
    })
  );
}

async function resolveLmsReferences(area) {
  const [branchIds, managerIds] = await Promise.all([
    resolveLmsBranchIds(area),
    resolveLmsUserIds(area),
  ]);
  return { branchIds, managerIds };
}

async function resolveLmsBranchIds(area) {
  const hrisBranchIds = area.branches?.map((b) => b.id) ?? [];
  const lmsIds = await hrisBranchIdsToLmsBranchIds(hrisBranchIds);
  return JSON.stringify(lmsIds);
}

async function resolveLmsUserIds(area) {
  const hrisUserIds = area.managers?.map((m) => m.employee_id) ?? []
  const lmsIds = await hrisUserIdsToLmsUserIds(hrisUserIds);
  return JSON.stringify(lmsIds);
}