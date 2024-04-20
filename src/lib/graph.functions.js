import { GraphProvider } from "@/lib/graph/graph.provider";
import { USER_FIELDS } from "@/lib/graph.fields";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

/** @return Promise<any> */
export async function findUserById(id, fields = USER_FIELDS) {
  const res = await graph.query(queryQl(createGraphType('users', fields)(), { where: { _id: { _eq: id } } }));
  return res.data?.users?.[0];
}
