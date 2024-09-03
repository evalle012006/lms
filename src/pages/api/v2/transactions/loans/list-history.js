import { apiHandler } from "@/services/api-handler";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import {
  BRANCH_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { findUserById } from '@/lib/graph.functions';

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
  const { branchId, groupId, loId, currentUserId, mode, month, year } = req.query;
  let filter;
  let mapper;

  if (loId) {
    filter = {
      loId: { _eq: loId },
      status: { _neq: "pending" },
      occurence: { _eq: mode },
      dateGrantedMonthYear: { _eq: `${month}/${year}` }
    };
  } else if (branchId) {
    filter = {
      branchId: { _eq: branchId },
      status: { _neq: "pending" },
      dateGrantedMonthYear: { _eq: `${month}/${year}` }
    };
    mapper = (row) => ({ ...row, branch: [row.branch] });
  } else if (groupId) {
    filter = {
      groupId: { _eq: groupId },
      status: { _neq: "pending" },
      occurence: { _eq: mode },
      dateGrantedMonthYear: { _eq: `${month}/${year}` }
    };
    mapper = (row) => ({ ...row, branch: [row.branch] });
  } else if (currentUserId) {
    filter = {
      status: { _neq: "pending" },
      dateGrantedMonthYear: { _eq: `${month}/${year}` }
    };
    const user = await findUserById(currentUserId);
    if (user.areaId && user.role.shortCode === 'area_admin') {
      filter.branch = { areaId: { _eq: user.areaId }};
    } else if (user.regionId && user.role.shortCode === 'regional_manager') {
      filter.branch = { regionId: { _eq: user.regionId }};
    } else if (user.divisionId && user.role.shortCode === 'deputy_director') {
      filter.branch = { divisionId: { _eq: user.divisionId }};
    }
  } else {
    filter = {
      status: { _neq: "pending" },
      dateGrantedMonthYear: { _eq: `${month}/${year}` }
    };
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
