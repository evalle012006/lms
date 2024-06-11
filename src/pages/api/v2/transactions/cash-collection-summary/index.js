import { apiHandler } from "@/services/api-handler";
import moment from "moment";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { findLosTotals, findUserById } from "@/lib/graph.functions";
import { gql } from "apollo-boost";
import { createGraphType, insertQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

export default apiHandler({
  get: getSummary,
});

async function getSummary(req, res) {
  const { date, userId, branchId, loId, filter, loGroup } = req.query;
  let response = {};
  let data;

  const user = await findUserById(userId);

  if (user) {
    const currentMonth = moment(date).month() + 1;
    const currentYear = moment(date).year();

    const lastMonth = moment(date).subtract(1, "months").month() + 1;
    const lastYear = lastMonth === 12
        ? moment(date).subtract(1, "years").year()
        : moment(date).year();

    const userId = user._id + "";

    let fBalance = [];
    let fBalanceMigration = [];
    let summary = [];

    if (user.role.rep === 3) {
      await getFBalanceMigration(
        branchId,
        lastMonth,
        lastYear,
        userId,
        loGroup
      );
      fBalance = await findLosTotals({
        userId: { _eq: userId },
        month: { _eq: lastMonth },
        year: { _eq: lastYear },
        losType: { _eq: "commulative" },
        officeType: { _eq: loGroup },
      });

      const query = gql`
        query get_data($args: get_cash_collection_summary_arguments!) {
          summary: get_cash_collection_summary(args: $args) {
            _id
            data
          }
        }
      `;

      const args = {
        branchId,
        month: currentMonth,
        year: currentYear,
        loGroup,
      };

      summary = await graph.apollo
        .query({ query, variables: { args } })
        .then((res) => {
          if (res.errors) {
            console.error(res.errors);
            throw res.errors[0];
          }
          return res.data?.summary ?? [];
        })
        .then((transfers) => transfers.map(({ data }) => data));

    } else if (user.role.rep === 4) {
      fBalance = await findLosTotals({
        userId: { _eq: userId },
        month: { _eq: lastMonth },
        year: { _eq: lastYear },
        losType: { _eq: "commulative" },
      });

      summary = await findLosTotals({
        userId: { _eq: userId },
        month: { _eq: lastMonth },
        year: { _eq: lastYear },
        losType: { _eq: "daily" },
      });
    }

    data = {
      fBalance: fBalance.length > 0 ? fBalance : [],
      fBalanceMigration: fBalanceMigration,
      current: summary,
    };
  }

  response = { success: true, data: data };
  res.send(response);
}

const getFBalanceMigration = async (branchId, lastMonth, lastYear, userId, loGroup) => {
  const existingMigratedFBalance = await findLosTotals({
    userId: { _eq: userId },
    month: { _eq: lastMonth },
    year: { _eq: lastYear },
    losType: { _eq: "commulative" },
    insertedBy: { _eq: "migration" },
    officeType: { _eq: loGroup },
  });

  if (existingMigratedFBalance.length === 0) {
    const query = gql`
      query get_data($args: get_cash_collection_summary_migration_arguments!) {
        summary: get_cash_collection_summary_migration(args: $args) {
          _id
          data
        }
      }
    `;

    const args = {
      branchId,
      month: lastMonth,
      year: lastYear,
      loGroup,
    };

    const migratedFBalance = await graph.apollo
      .query({ query, variables: { args } })
      .then((res) => {
        if (res.errors) {
          console.error(res.errors);
          throw res.errors[0];
        }
        return res.data?.summary ?? [];
      })
      .then((transfers) => transfers.map(({ data }) => data));

    if (migratedFBalance.length > 0) {
      const monthStr = lastMonth < 10 ? "0" + lastMonth : lastMonth;
      const dateAdded = lastYear + "-" + monthStr + "-30";
      let temp = { ...migratedFBalance[0] };

      temp.day = "Commulative";
      temp.grandTotal = true;

      const bmsFwBalance = {
        userId: userId,
        month: lastMonth,
        year: lastYear,
        data: temp,
        losType: "commulative",
        insertedBy: "migration",
        insertedDateTime: new Date(),
        dateAdded: dateAdded,
        officeType: loGroup,
      };

      await graph.mutation(
        insertQl(createGraphType("losTotals", "_id")(), {
          objects: [{ ...bmsFwBalance }],
        })
      );
    }
  }
};
