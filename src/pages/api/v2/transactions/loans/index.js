import { apiHandler } from "@/services/api-handler";
import logger from "@/logger";
import moment from "moment";
import { getCurrentDate } from "@/lib/date-utils";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import {
  BRANCH_FIELDS, CASH_COLLECTIONS_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { filterGraphFields } from '@/lib/graph.functions';
import { savePendingLoans } from "../cash-collections/update-pending-loans";

const fields = `
  ${LOAN_FIELDS}
  branch { ${BRANCH_FIELDS} }
  group { ${GROUP_FIELDS} }
  client { ${CLIENT_FIELDS} }
`;

const loanType = createGraphType("loans", fields)();
const cashCollectionsType = createGraphType("cashCollections", "_id")();
const cashCollectionsTypeFull = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS)
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
  
  const user_id = req?.auth?.sub;
  const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD')

  const groupCashCollections = (await graph.query(queryQl(cashCollectionsTypeFull(), {
        where: {
          groupId: { _eq: loan.groupId },
          dateAdded: { _eq: currentDate },
        }
  }))).data?.cashCollections;

  let groupStatus = 'pending';
  let hasExistingCC = false;
  if (groupCashCollections.length > 0) {
      const groupStatuses = groupCashCollections.filter(cc => cc.groupStatus === 'pending');
      if (groupStatuses.length === 0) {
          groupStatus = 'closed';
      }

      const existingCC = groupCashCollections.find(cc => cc.clientId === loan.clientId);
      hasExistingCC = (existingCC && existingCC?.status == 'completed') ? true : false;
  }

  // the mixed type from mongo during migration
  let updatedLoan = { ...loan };
  updatedLoan.coMaker = loan.coMaker?.toString();
  updatedLoan.modifiedBy = user_id;
  updatedLoan.modifiedDateTime = new Date().toISOString();

  const loanResp = await graph.mutation(
    updateQl(loanType, {
      where: { _id: { _eq: loanId } },
      set: filterGraphFields(LOAN_FIELDS, { ...updatedLoan }),
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

  if (hasExistingCC) {
    if (groupStatus == 'closed') {
      res.send({ error: true, message: 'This client has a completed loan but the group transaction was already closed!' })
    } else {
      await savePendingLoans(user_id, [updatedLoan], loanId);
    }
  }

  res.send({ success: true, loan: loanResp });
}
