import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, GROUP_FIELDS,
  LOAN_FIELDS,
  USER_FIELDS,
} from "@/lib/graph.fields";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

/** @return Promise<any> */
export async function findUserById(id, fields = USER_FIELDS) {
  return (await graph.query(queryQl(createGraphType('users', fields)(), { where: { _id: { _eq: id } } })))
    .data?.users?.[0];
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
