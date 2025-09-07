import {
  createGraphType,
  insertQl,
  queryQl,
  updateQl,
} from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  fetchFromHris,
  hrisRegionIdsToLmsRegionIds,
  hrisUserIdsToLmsUserIds,
} from "@/pages/api/webhook/hris-webhook-handlers/common";

const graph = new GraphProvider();

export async function insertOrUpdateDivision(division) {
  console.log(`Syncing updates from HRIS for division ${division.id} ${division.name}`);
  if (division.name.match(/exit\s+staff/i)) {
    console.log(`Skipping Exit Staff division.`);
    return;
  }
  
  const hrisDivisionFullInfo = await fetchFromHris(`divisions/${division.id}`)
    .then((data) => data.division);
  
  const savedDivision = await graph.query(queryQl(createGraphType("divisions", "_id")(), { where: { hrisId: { _eq: division.id } } }));
  if (savedDivision.data?.divisions?.length) {
    await updateDivision(hrisDivisionFullInfo);
  } else {
    await insertDivision(hrisDivisionFullInfo);
  }

  console.log(`Done syncing updates from HRIS for division ${division.id} ${division.name}`);
}

async function insertDivision(division) {
  console.log(`Inserting division ${division.id} ${division.name}`);
  return graph.mutation(
    insertQl(createGraphType("divisions", "_id")(), {
      objects: [
        {
          _id: division.id,
          name: division.name,
          dateAdded: division.create_date,
          dateModified: division.modify_date,
          hrisId: division.id,
          ...(await resolveLmsReferences(division)),
        },
      ],
    })
  );
}

async function updateDivision(division) {
  console.log(`Updating region ${division.id} ${division.name}`);
  return graph.mutation(
    updateQl(createGraphType("divisions", "_id")(), {
      set: {
        name: division.name,
        dateModified: division.modify_date,
        ...(await resolveLmsReferences(division)),
      },
      where: { hrisId: { _eq: division.id } },
    })
  );
}

async function resolveLmsReferences(division) {
  const [managerIds, regionIds] = await Promise.all([
    resolveLmsUserIds(division),
    resolveLmsRegionIds(division)
  ]);
  
  return { managerIds, regionIds };
}

async function resolveLmsUserIds(division) {
  const hrisEmployeeIds = division.managers?.map(m => m.employee_id) ?? [];
  return hrisUserIdsToLmsUserIds(hrisEmployeeIds);
}

async function resolveLmsRegionIds(division) {
  const hrisRegionIds = division.regions?.map(r => r.id) ?? [];
  return hrisRegionIdsToLmsRegionIds(hrisRegionIds);
}
