import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { LOAN_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { toDto } from "@/pages/api/v2/other-transactions/badDebtCollection/common";

const graph = new GraphProvider();
const loanType = createGraphType("loans", `
  ${LOAN_FIELDS}
  client { _id, name:fullName }
  loanOfficer { _id, firstName, lastName }
  branch { _id, name }
  group { _id, name }
  `)();

export default apiHandler({
  get: list,
});

async function list(req, res) {
  let filter;
  const { loId, branchId, currentUserId } = req.query;

  if (loId) {
    filter = {
      loId: { _eq: loId },
      maturedPD: { _eq: true },
      status: { _eq: "closed" },
    };
  } else {
    if (branchId) {
      filter = { branchId: { _eq: branchId } };
    } else {
      if (currentUserId) {
        const user = await findUserById(currentUserId);
        if (user) {
          let branchIds = [];
          if (user.areaId && user.role.shortCode === "area_admin") {
            filter = { branch: { areaId: { _eq: user.areaId } } };
          } else if (
            user.regionId &&
            user.role.shortCode === "regional_manager"
          ) {
            filter = { branch: { regionId: { _eq: user.areaId } } };
          } else if (
            user.divisionId &&
            user.role.shortCode === "deputy_director"
          ) {
            filter = { branch: { divisionId: { _eq: user.divisionId } } };
          }
        }
      } else {
        filter = { branch: { _id: { _is_null: false } } };
      }
    }
  }

  let graphRes;
  if (filter) {
    graphRes = await graph.query(
      queryQl(loanType, {
        where: filter,
      })
    );
  }

  res.send({
    success: true,
    data: graphRes?.data?.loans?.map(toDto) ?? [],
  });
}
