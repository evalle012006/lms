import { apiHandler } from "@/services/api-handler";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import {
  BRANCH_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";

const fields = `
  ${LOAN_FIELDS}
  branch { ${BRANCH_FIELDS} }
  group { ${GROUP_FIELDS} }
  client { ${CLIENT_FIELDS} }
`;
const loanType = createGraphType("loans", fields)();
const graph = new GraphProvider();

export default apiHandler({
  get: list,
});

async function list(req, res) {
  const { branchId, groupId, loId, mode } = req.query;
  let filter;
  let mapper;

  if (loId && branchId) {
    filter = {
      branchId: { _eq: branchId },
      status: { _neq: "pending" },
      occurence: { _eq: mode },
    };
  } else if (branchId) {
    filter = {
      branchId: { _eq: branchId },
      status: { _neq: "pending" },
    };
    mapper = (row) => ({ ...row, branch: [row.branch] });
  } else if (groupId) {
    filter = {
      groupId: { _eq: groupId },
      status: { _neq: "pending" },
      occurence: { _eq: mode },
    };
    mapper = (row) => ({ ...row, branch: [row.branch] });
  } else {
    filter = { status: { _neq: "pending" } };
    mapper = (row) => ({ ...row, branch: [row.branch] });
  }

  const loans = await graph
    .query(
      queryQl(loanType, { where: filter, order_by: [{ dateAdded: "desc" }] })
    )
    .then((res) => res.data?.loans ?? [])
    .then((loans) => (mapper ? loans.map(mapper) : loans));

  res.send({ success: true, loans });
}
