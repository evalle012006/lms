import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { findUserById } from "@/lib/graph.functions";
import { gql } from "apollo-boost";
import moment from "node_modules/moment/moment";

const graph = new GraphProvider();

export default apiHandler({
  get: list,
});

async function list(req, res) {
  let loans;
  let rowMapper;
  let args;

  const { branchId, groupId, loId, status, currentUserId, mode } = req.query;
  const currentDate = new Date(req.query).toString() === 'Invalid Date' ? moment(new Date()).format("YYYY-MM-DD") : req.query.currentDate;
  if (status) {
    // for lo
    if (loId && branchId) {
      args = {
        branchId,
        status,
        occurrence: mode,
        currentDate,
        pendingLoanStatus1: "active",
      };
    }
    // for bm
    else if (branchId) {
      args = {
        branchId,
        status,
        currentDate,
        pendingLoanStatus1: "active",
        pendingLoanStatus2: "completed",
      };
      rowMapper = (row) => {
        row.branch = [row.branch];
      };
    }
    // by groupId
    else if (groupId) {
      args = { groupId, status, occurrence: mode, currentDate };
      rowMapper = (row) => {
        row.branch = [row.branch];
      };
    }
    // by areaId, regionId, or divisionId
    else if (currentUserId) {
      const user = await findUserById(currentUserId);
      if (user) {
        if (user.areaId && user.role.shortCode === "area_admin") {
          args = { areaId: user.areaId };
        } else if (
          user.regionId &&
          user.role.shortCode === "regional_manager"
        ) {
          args = { regionId: user.regionId };
        } else if (
          user.divisionId &&
          user.role.shortCode === "deputy_director"
        ) {
          args = { divisionId: user.divisionId };
        }

        args.currentDate = currentDate;

        rowMapper = (row) => {
          row.branch = [row.branch];
        };
      }
    }
    // all pending
    else {
      args = { status: 'pending', currentDate };
      rowMapper = (row) => {
        row.branch = [row.branch];
      };
    }
  } else {
    // loId and branchId
    if (loId && branchId) {
      args = { loId, branchId, currentDate };
    }
    // branchId
    else if (branchId) {
      args = { branchId, currentDate };
      rowMapper = (row) => {
        row.branch = [row.branch];
      };
    }
    // groupId
    else if (groupId) {
      args = { groupId, occurrence: mode, currentDate };
      rowMapper = (row) => {
        row.branch = [row.branch];
      };
    }
    // query 9
    else {
      args = { status: 'pending', currentDate };
      rowMapper = (row) => {
        row.branch = [row.branch];
      };
    }
  }

  const query = gql`
    query get_data($args: get_loan_data_for_pending_loans_page_arguments!) {
      loans: get_loan_data_for_pending_loans_page (args: $args) {
        _id, data
      }
    }
  `;

  loans = await graph.apollo
    .query({ query, variables: { args } })
    .then((res) => {
      if (res.errors) {
        console.error(res.errors);
        throw res.errors[0];
      }
      return res.data?.loans ?? [];
    })
    .then((loans) =>
      loans.map(({ data }) => {
        const loan = { ...data };
        rowMapper?.(loan);
        return loan;
      })
    );

  res.send({
    success: true,
    loans,
  });
}
