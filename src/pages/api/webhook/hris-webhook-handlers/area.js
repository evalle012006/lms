import {
  createGraphType,
  insertQl,
  queryQl,
  updateQl,
} from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { hrisBranchIdsToLmsBranchIds, hrisUserIdsToLmsUserIds } from "@/pages/api/webhook/hris-webhook-handlers/common";

const graph = new GraphProvider();
const areaGraphType = createGraphType("areas", "_id")();

export async function insertOrUpdateArea(area) {
  console.log(`Syncing updates from HRIS for area ${area.id} ${area.name}`);
  if (area.name.match(/exit\s+staff/i)) {
    console.log(`Skipping Exit Staff Area.`);
    return;
  }

  console.log(`Fetching full area info ${area.id} ${area.name} from HRIS to insert`);
  const hrisAreaFullInfo = await getAreaInfoFromHris(area.id);

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
          branchIds: JSON.stringify(await resolveLmsBranchIds(hrisAreaFullInfo)),
          dateAdded: hrisAreaFullInfo.create_date,
          dateModified: hrisAreaFullInfo.modify_date,
          managerIds: JSON.stringify(await resolveLmsUserIds(hrisAreaFullInfo)),
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
        branchIds: JSON.stringify(await resolveLmsBranchIds(hrisAreaFullInfo)),
        dateModified: hrisAreaFullInfo.modify_date,
        managerIds: JSON.stringify(await resolveLmsUserIds(hrisAreaFullInfo)),
        name: hrisAreaFullInfo.name,
        regionId: hrisAreaFullInfo.region_id,
        divisionId: hrisAreaFullInfo.division_id,
      },
      where: { hrisId: { _eq: hrisAreaFullInfo.id } },
    })
  );
}

async function getAreaInfoFromHris(id) {
  const url = `${process.env.HRIS_HASURA_URL}/api/rest/areas/${id}`;
  console.log(`Fetching area full info from: ${url}`);

  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `${process.env.HRIS_HASURA_AUTH_TOKEN}`,
    },
  });

  if (result.status !== 200) {
    throw new Error(`Failed to fetch full area info for area ID ${id}`);
  }

  const data = await result.json();
  if (data.errors?.length) {
    throw new Error(`Failed to fetch full area info for area ID ${id}. Cause: ${data.errors[0]}`);
  }

  return data.area;
}

async function resolveLmsBranchIds(hrisAreaFullInfo) {
  const hrisBranchIds = hrisAreaFullInfo.branches?.map((b) => b.id) ?? [];
  return hrisBranchIdsToLmsBranchIds(hrisBranchIds);
}

async function resolveLmsUserIds(hrisAreaFullInfo) {
  const hrisUserIds = hrisAreaFullInfo.managerIds?.map((m) => m.employee_id) ?? []
  return hrisUserIdsToLmsUserIds(hrisUserIds);
}