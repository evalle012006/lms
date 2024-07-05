import { apiHandler } from "@/services/api-handler";
import logger from "@/logger";
import moment from "moment";
import { getCurrentDate } from "@/lib/utils";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import {
  BRANCH_FIELDS, CASH_COLLECTIONS_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { filterGraphFields } from '@/lib/graph.functions';

const fields = `
  ${LOAN_FIELDS}
  branch { ${BRANCH_FIELDS} }
  group { ${GROUP_FIELDS} }
  client { ${CLIENT_FIELDS} }
`;

const loanType = createGraphType("loans", fields)();
const cashCollectionsType = createGraphType("cashCollections", "_id")();
const graph = new GraphProvider();

export default apiHandler({
  get: getLoan,
  post: updateLoan,
});

async function getLoan(req, res) {
  const { _id } = req.query;
  const loan = await graph
    .query(queryQl(loanType, { where: { _id: { _eq: _id } } }))
    .then((res) => res.data?.loans?.[0])
    .then((loan) => ({ ...loan, branch: [loan.branch] }));

  res.send({ success: true, loan });
}

async function updateLoan(req, res) {
  const { _id: loanId, group, ...loan } = req.body;

  logger.debug({ page: `Updating Loan: ${loan.clientId}`, data: loan });
  const currentDate = moment(getCurrentDate()).format("YYYY-MM-DD");
  let dateOfRelease = null;

  if (loan?.loanFor === "tomorrow") {
    dateOfRelease = moment(currentDate).add(1, "days").format("YYYY-MM-DD");
  }

  // the mixed type from mongo during migration
  loan.coMaker = loan.coMaker?.toString();

  const loanResp = await graph.mutation(
    updateQl(loanType, {
      where: { _id: { _eq: loanId } },
      set: filterGraphFields(LOAN_FIELDS, { ...loan, dateOfRelease }),
    })
  );

  await graph.mutation(
    updateQl(cashCollectionsType, {
      where: {
        loanId: { _eq: loanId },
        status: { _in: ["tomorrow", "pending"] },
      },
      set: filterGraphFields(CASH_COLLECTIONS_FIELDS, { currentReleaseAmount: loan.amountRelease }),
    })
  );

  res.send({ success: true, loan: loanResp });
}
