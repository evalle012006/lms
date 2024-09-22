import { apiHandler } from "@/services/api-handler";
import moment from "moment";
import logger from "@/logger";
import { getCurrentDate } from "@/lib/utils";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, updateQl } from "@/lib/graph/graph.util";
import { findCashCollections, findLoans } from "@/lib/graph.functions";

const graph = new GraphProvider();
const loansType = createGraphType('loans', '_id');
const ccType = createGraphType('cashCollections', '_id')();

export default apiHandler({
    post: save
});

async function save(req, res) {
    let data = req.body;
    logger.debug({page: `Update Cash Collection For Pending Loans - Group ID: ${data[0].groupId}`});
    await savePendingLoans(data)
    res.send({ success: true });
}

export async function savePendingLoans(collections) {
  logger.debug({page: `Update Cash Collection For Pending Loans`, pendingLoans: collections});
  const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
  await Promise.all(collections.map(async cc => {
      if ((cc?.loanFor === 'today' || (cc?.loanFor === 'tomorrow' && cc?.dateOfRelease === currentDate))) {
        await updatePendingLoan(cc, currentDate);
    } else {
        await graph.mutation(
          updateQl(loansType(), {
            set: { status: 'completed' },
            where: { _id: { _eq: cc.loanId } }
          }),
          updateQl(ccType, {
            set: { status: 'completed' },
            where: {
              clientId: { _eq: cc.clientId },
              dateAdded: { _eq: currentDate },
            }
          })
        );
    }
  }))
}

async function updatePendingLoan(collection, currentDate) {
    logger.debug({page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentDate: currentDate});

    let currentLoan = await findLoans({ _id: { _eq: collection.loanId } });
    let pendingLoan = await findLoans({
      clientId: { _eq: collection.clientId },
      status: { _eq: "pending" },
    });

    let cashCollection = await findCashCollections({
      clientId: { _eq: collection.clientId },
      dateAdded: { _eq: currentDate },
    });
    
    logger.debug({page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentLoanSize: currentLoan.length, pendingLoanSize: pendingLoan.length, cashCollectionSize: cashCollection.length, currentLoan});
    if (currentLoan.length > 0 && pendingLoan.length > 0 && cashCollection.length > 0) {
        currentLoan = currentLoan[0];
        pendingLoan = pendingLoan[0];
        cashCollection = cashCollection[0];

        const toUpdatePendingLoan = {
          mcbu: cashCollection.mcbu,
          prevLoanFullPaymentDate: currentDate,
          prevLoanFullPaymentAmount: collection.fullPayment,
          mcbu: collection.mcbu,
          mcbuWithdrawal: collection.mcbuWithdrawal
        };

        const toUpdateCurrentLoan = {
          status: 'closed',
          loanBalance: 0,
          amountRelease: 0,
          activeLoan: 0,
          mcbu: 0,
          mcbuCollection: collection.mcbu,
          noOfPayments: collection.noOfPayments,
          fullPaymentDate:  collection.fullPaymentDate ? collection.fullPaymentDate : currentDate,
          mcbuWithdrawal: collection.mcbuWithdrawal > 0 ? collection.mcbuWithdrawal : 0,
          mcbuReturnAmt: collection.mcbuReturnAmt > 0 ? collection.mcbuReturnAmt : 0,
          history: cashCollection.history ? cashCollection.history : collection.history
        };

        const toUpdateCollection = {
          loanId: pendingLoan._id,
          currentReleaseAmount: pendingLoan.amountRelease,
          prevLoanId: currentLoan._id,
          status: 'tomorrow',
        };


        const currentLoanId = currentLoan._id;
        const pendingLoanId = pendingLoan._id;
        const cashCollectionId = cashCollection._id;
        
        delete currentLoan._id;
        delete pendingLoan._id;
        delete cashCollection._id;

        logger.debug({page: `Saving Cash Collection - Updating Pending Loan`, currentLoan: toUpdateCurrentLoan, pendingLoan: toUpdatePendingLoan, cashCollection: toUpdateCollection });

        await graph.mutation(
          updateQl(loansType('current'), {
            set: { ... toUpdateCurrentLoan },
            where: { _id: { _eq: currentLoanId } }
          }),
          updateQl(loansType('pending'), {
            set: { ... toUpdatePendingLoan },
            where: { _id: { _eq: pendingLoanId } }
          }),
          updateQl(ccType, {
            set: { ... toUpdateCollection },
            where: { _id: { _eq: cashCollectionId } }
          })
        ).catch(err => {
          logger.error(err);
          throw err;
        })
    }
}