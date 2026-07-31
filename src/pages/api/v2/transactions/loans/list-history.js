import { apiHandler } from "@/services/api-handler";
import { createGraphType, queryQl, aggregateQl } from "@/lib/graph/graph.util";
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
  const { branchId, groupId, loId, currentUserId, mode, month, year, page, pageSize, all } = req.query;

  // Export escape hatch: explicit opt-in, still bounded (not truly unlimited)
  // to protect against a single month somehow ballooning past sane size.
  // 5000 is a soft ceiling — revisit if a branch/month legitimately exceeds it.
  const isExportAll = all === 'true';
  const currentPage = isExportAll ? 1 : Math.max(parseInt(page, 10) || 1, 1);
  const limit = isExportAll ? 5000 : Math.min(parseInt(pageSize, 10) || 100, 200);
  const offset = isExportAll ? 0 : (currentPage - 1) * limit;

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
    // Still unscoped if currentUserId belongs to a rep=1 admin/root user with
    // none of the above shortCodes (no area/region/division). If admin/root
    // ever calls this with currentUserId set, it falls through to a
    // company-wide filter — same underlying issue as the bare `else` below,
    // just reached via a different param combination. Worth confirming this
    // is intentional.
  } else {
    // Was: fully unscoped, company-wide, unbounded — the branch almost
    // certainly responsible for the OOM. Now bounded by limit/offset below,
    // but still not scoped by role. If rep=1 admins are meant to see
    // "everything, just paginated," this is fine. If there's meant to be
    // any narrowing (e.g. active branches only), that's a separate change.
    filter = {
      status: { _neq: "pending" },
      dateGrantedMonthYear: { _eq: `${month}/${year}` }
    };
    mapper = (row) => ({ ...row, branch: [row.branch] });
  }

  const [loans, countResult] = await Promise.all([
    graph
      .query(
        queryQl(loanType, {
          where: filter,
          order_by: [{ dateAdded: "desc" }],
          limit,
          offset
        })
      )
      .then((res) => res.data?.loans ?? [])
      .then((loans) => (mapper ? loans.map(mapper) : loans)),
    graph.query(
      aggregateQl(loanType, "aggregate { count }", filter)
    )
  ]);

  const total = countResult.data?.loans_aggregate?.aggregate?.count ?? 0;

  res.send({
    success: true,
    loans,
    pagination: {
      page: currentPage,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}