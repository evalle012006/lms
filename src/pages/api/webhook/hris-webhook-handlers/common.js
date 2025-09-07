import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";

const graph = new GraphProvider();

export async function hrisBranchIdsToLmsBranchIds(hrisBranchIds) {
  if (!hrisBranchIds?.length)
    return [];

  console.log(`Resolving HRIS branch IDs into LMS branch IDs`);
  const branchType = createGraphType('branches', '_id')();
  const result = await graph.query(queryQl(branchType, { where: { hrisId: { _in: hrisBranchIds }}}));
  return result.data?.branches?.map(b => b._id) ?? [];
}

export async function hrisUserIdsToLmsUserIds(hrisUserIds) {
  if (!hrisUserIds?.length)
    return [];

  console.log(`Resolving HRIS employee IDs into LMS user IDs`);
  const branchType = createGraphType('users', '_id')();
  const result = await graph.query(queryQl(branchType, { where: { hrisId: { _in: hrisUserIds }}}));
  return result.data?.branches?.map(b => b._id) ?? [];
}

export async function hrisAreaIdsToLmsAreaIds(hrisAreaIds) {
  if (!hrisAreaIds?.length)
    return [];
  
  console.log(`Resolving HRIS area IDs into LMS area IDs`);
  const areaType = createGraphType('areas', '_id')();
  const result = await graph.query(queryQl(areaType, { where: { hrisId: { _in: hrisAreaIds }}}));
  return result.data?.areas?.map(a => a._id) ?? [];
}

export async function hrisRegionIdsToLmsRegionIds(hrisRegionIds) {
  if (!hrisRegionIds?.length)
    return [];
  
  console.log(`Resolving HRIS region IDs into LMS region IDs`);
  const regionType = createGraphType('regions', '_id')();
  const result = await graph.query(queryQl(regionType, { where: { hrisId: { _in: hrisRegionIds }}}));
  return result.data?.regions?.map(r => r._id) ?? [];
}

export async function hrisDivisionIdsToLmsDivisionIds(hrisDivisionIds) {
  if (!hrisDivisionIds?.length)
    return [];
  
  console.log(`Resolving HRIS division IDs into LMS division IDs`);
  const divisionType = createGraphType('divisions', '_id')();
  const result = await graph.query(queryQl(divisionType, { where: { hrisId: { _in: hrisDivisionIds }}}));
  return result.data?.divisions?.map(d => d._id) ?? [];
}

export async function fetchFromHris(restPath) {
  const url = `${process.env.HRIS_HASURA_URL}/api/rest/${restPath}`;
  console.log(`Fetching from HRIS: ${url}`);

  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `${process.env.HRIS_HASURA_AUTH_TOKEN}`,
    },
  });

  if (result.status !== 200) {
    throw new Error(`Failed to fetch from HRIS for resource ${url}`);
  }

  const data = await result.json();
  if (data.errors?.length) {
    throw new Error(`Failed to fetch from HRIS. Cause: ${data.errors[0]}`);
  }

  return data;
}