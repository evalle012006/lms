import {
  createGraphType,
  insertQl,
  queryQl,
  updateQl,
} from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  fetchFromHris,
  hrisAreaIdsToLmsAreaIds,
  hrisUserIdsToLmsUserIds,
} from "@/pages/api/webhook/hris-webhook-handlers/common";

const graph = new GraphProvider();
const regionGraphType = createGraphType("regions", "_id")();

export async function insertOrUpdateRegion(region) {
  console.log(`Syncing updates from HRIS for region ${region.id} ${region.name}`);
  if (region.name.match(/exit\s+staff/i)) {
    console.log(`Skipping Exit Staff region.`);
    return;
  }

  const hrisRegionFullInfo = await fetchFromHris(`regions/${region.id}`)
    .then((data) => data.region);
  
  const savedRegion = await graph.query(queryQl(regionGraphType, { where: { hrisId: { _eq: region.id } } }));
  if (savedRegion.data?.regions?.length) {
    await updateRegion(hrisRegionFullInfo);
  } else {
    await insertRegion(hrisRegionFullInfo);
  }

  console.log(`Done syncing updates from HRIS for region ${region.id} ${region.name}`);
}

async function insertRegion(region) {
  console.log(`Inserting region ${region.id} ${region.name}`);
  
  const [areaIds, managerIds] = await Promise.all([
    resolveLmsAreaId(region),
    resolveLmsUserIds(region)
  ]);
  
  return graph.mutation(
    insertQl(regionGraphType, {
      objects: [
        {
          _id: region.id,
          areaIds: areaIds,
          dateAdded: region.create_date,
          dateModified: region.modify_date,
          divisionId: region.division_id,
          managerIds: managerIds,
          name: region.name,
          hrisId: region.id,
        },
      ],
    })
  );
}

async function updateRegion(region) {
  console.log(`Updating region ${region.id} ${region.name}`);

  const [areaIds, managerIds] = await Promise.all([
    resolveLmsAreaId(region),
    resolveLmsUserIds(region)
  ]);
  
  return graph.mutation(
    updateQl(regionGraphType, {
      set: {
        areaIds: areaIds,
        dateModified: region.modify_date,
        divisionId: region.division_id,
        managerIds: managerIds,
        name: region.name,
      },
      where: { hrisId: { _eq: region.id } },
    })
  );
}

async function resolveLmsAreaId(hrisRegionFullInfo) {
  const hrisRegionIds = hrisRegionFullInfo.areas?.map(a => a.id) ?? [];
  const lmsIds = await hrisAreaIdsToLmsAreaIds(hrisRegionIds);
  return JSON.stringify(lmsIds);
}

async function resolveLmsUserIds(hrisRegionFullInfo) {
  const hrisUserIds = hrisRegionFullInfo.managers?.map((m) => m.employee_id) ?? []
  const lmsIds = await hrisUserIdsToLmsUserIds(hrisUserIds);
  return JSON.stringify(lmsIds);
}