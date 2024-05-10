import { apiHandler } from "@/services/api-handler";
import { getCurrentDate } from "@/lib/utils";
import moment from "moment";
import {
  BRANCH_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
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
  const { groupId } = req.query;
  const date = moment(getCurrentDate()).format("YYYY-MM-DD");

  const loans =
    (
      await graph.query(
        queryQl(loanType, {
          where: {
            groupId: { _eq: groupId },
            _or: [
              { dateGranted: { _eq: date } },
              { status: { _eq: "pending" } },
            ],
          },
        })
      )
    ).data?.loans ?? [];

  res.send({
    success: true,
    loans: loans.map((l) => ({ ...l, branch: [l.branch] })),
  });
}
