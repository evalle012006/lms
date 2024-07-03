import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  AREA_FIELDS,
  BRANCH_FIELDS,
  CASH_COLLECTIONS_FIELDS,
  CLIENT_FIELDS, DIVISION_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS, LOS_TOTALS_FIELDS,
  TRANSFER_CLIENT_FIELDS,
  USER_FIELDS,
} from "@/lib/graph.fields";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

/** @return Promise<any> */
export async function findUserById(id, fields = USER_FIELDS) {
  return (await graph.query(queryQl(createGraphType('users', fields)(), { where: { _id: { _eq: id } } })))
    .data?.users?.[0];
}

export async function findUsers(filter, fields = USER_FIELDS) {
  return (await graph.query(queryQl(createGraphType('users', fields)(), { where: filter })))
    .data?.users ?? [];
}

export async function findLoans(filter, fields = LOAN_FIELDS) {
  return (await graph.query(queryQl(createGraphType('loans', fields)(), { where: filter })))
    .data?.loans ?? [];
}

export async function findCashCollections(filter, fields = CASH_COLLECTIONS_FIELDS) {
  return (await graph.query(queryQl(createGraphType('cashCollections', fields)(), { where: filter })))
    .data?.cashCollections ?? [];
}

export async function findClients(filter, fields = CLIENT_FIELDS) {
  return (await graph.query(queryQl(createGraphType('clients', fields)(), { where: filter })))
    .data?.clients ?? [];
}

export async function findGroups(filter, fields = GROUP_FIELDS) {
  return (await graph.query(queryQl(createGraphType('groups', fields)(), { where: filter })))
    .data?.groups ?? [];
}

export async function findTransferClients(filter, fields = TRANSFER_CLIENT_FIELDS) {
  return (await graph.query(queryQl(createGraphType('transferClients', fields)(), { where: filter })))
    .data?.transferClients ?? [];
}

export async function findBranches(filter, fields = BRANCH_FIELDS) {
  return (await graph.query(queryQl(createGraphType('branches', fields)(), { where: filter })))
    .data?.branches ?? [];
}

export async function findLosTotals(filter, fields = LOS_TOTALS_FIELDS) {
  return (await graph.query(queryQl(createGraphType('losTotals', fields)(), { where: filter })))
    .data?.losTotals ?? [];
}

export async function findAreas(filter, fields = AREA_FIELDS) {
  return (await graph.query(queryQl(createGraphType('areas', fields)(), { where: filter })))
    .data?.areas ?? [];
}

export async function findDivisions(filter, fields = DIVISION_FIELDS) {
  return (await graph.query(queryQl(createGraphType('divisions', fields)(), { where: filter })))
    .data?.divisions ?? [];
}