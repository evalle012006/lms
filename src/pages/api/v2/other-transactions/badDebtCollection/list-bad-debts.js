import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { LOAN_FIELDS, BRANCH_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { toDto } from "@/pages/api/v2/other-transactions/badDebtCollection/common";

const graph = new GraphProvider();
const loanType = createGraphType(
  "loans",
  `
  ${LOAN_FIELDS}
  client { _id, name:fullName }
  loanOfficer { _id, firstName, lastName }
  branch {
    ${BRANCH_FIELDS}
  }
  group { _id, name }
  `
)();

export default apiHandler({
  get: list,
});

async function list(req, res) {
  let filter = {};

  const {
    loId,
    branchId,
    currentUserId
  } = req.query;

  /*
   * Priority:
   * 1. Loan Officer
   * 2. Branch
   * 3. Area / Region / Division
   * 4. Admin / unrestricted users = all branches
   */

  if (loId) {
    filter = {
      loId: { _eq: loId }
    };
  } else if (branchId) {
    filter = {
      branchId: { _eq: branchId }
    };
  } else if (currentUserId) {
    const user =
      await findUserById(currentUserId);

    if (user) {
      const roleShortCode =
        user.role?.shortCode;

      if (
        user.areaId &&
        roleShortCode === "area_admin"
      ) {
        filter = {
          branch: {
            areaId: {
              _eq: user.areaId
            }
          }
        };
      } else if (
        user.regionId &&
        roleShortCode ===
          "regional_manager"
      ) {
        filter = {
          branch: {
            regionId: {
              _eq: user.regionId
            }
          }
        };
      } else if (
        user.divisionId &&
        roleShortCode ===
          "deputy_director"
      ) {
        filter = {
          branch: {
            divisionId: {
              _eq: user.divisionId
            }
          }
        };
      } else {
        /*
         * Admin / unrestricted role:
         * show Bad Debts from all branches.
         */
        filter = {
          branch: {
            _id: {
              _is_null: false
            }
          }
        };
      }
    } else {
      /*
       * User wasn't resolved.
       * Keep query valid instead of
       * leaving filter undefined.
       */
      filter = {
        branch: {
          _id: {
            _is_null: false
          }
        }
      };
    }
  } else {
    filter = {
      branch: {
        _id: {
          _is_null: false
        }
      }
    };
  }

  let graphRes;

  if (filter) {
    graphRes = await graph.query(
      queryQl(loanType, {
        where: {
          maturedPD: { _eq: true },
          status: { _eq: "closed" },
          maturedPastDue: { _gt: 0 },  // CRITICAL FIX: Only show loans with actual past due > 0
          ...filter
        },
        limit: 2000
      })
    );
  }

  res.send({
    success: true,
    data: graphRes?.data?.loans?.map(toDto) ?? [],
  });
}