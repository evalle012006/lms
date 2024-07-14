import { apiHandler } from "@/services/api-handler";
import moment from "moment";
import logger from "@/logger";
import { getCurrentDate } from "@/lib/utils";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, updateQl } from "@/lib/graph/graph.util";
import { findCashCollections, findLoans } from "@/lib/graph.functions";

const graph = new GraphProvider();
const loansType = createGraphType('loans', '_id')();
const ccType = createGraphType('cashCollections', '_id')();

export default apiHandler({
    post: save
});

async function save(req, res) {
    let data = req.body;
    logger.debug({page: `Update Cash Collection For Pending Loans - Group ID: ${data[0].groupId}`});
    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
    data.map(async cc => {
        if ((cc?.loanFor === 'today' || (cc?.loanFor === 'tomorrow' && cc?.dateOfRelease === currentDate))) {
            await updatePendingLoan(cc, currentDate);
        } else {
            await graph.mutation(
              updateQl(loansType, {
                set: { status: 'completed' },
                where: { _id: { _eq: cc.loanId } }
              }),
              updateQl(ccType, {
                set: { status: 'completed' },
                where: {
                  clientId: { _eq: cc.clientId },
                  dateAdded: currentDate
                }
              })
            );
        }
    });

    res.send({ success: true });
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
    
    logger.debug({page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentLoanSize: currentLoan.length, pendingLoanSize: pendingLoan.length, cashCollectionSize: cashCollection.length});
    if (currentLoan.length > 0 && pendingLoan.length > 0 && cashCollection.length > 0) {
        currentLoan = currentLoan[0];
        pendingLoan = pendingLoan[0];
        cashCollection = cashCollection[0];

        pendingLoan.mcbu = cashCollection.mcbu;

        currentLoan.status = 'closed';
        currentLoan.loanBalance = 0;
        currentLoan.amountRelease = 0;
        currentLoan.activeLoan = 0;
        currentLoan.mcbu = 0;
        currentLoan.mcbuCollection = collection.mcbu;
        currentLoan.noOfPayments = collection.noOfPayments;
        currentLoan.fullPaymentDate = collection.fullPaymentDate ? collection.fullPaymentDate : currentDate;
        currentLoan.mcbuWithdrawal = collection.mcbuWithdrawal > 0 ? collection.mcbuWithdrawal : 0;
        currentLoan.mcbuReturnAmt = collection.mcbuReturnAmt > 0 ? collection.mcbuReturnAmt : 0;
        currentLoan.history = collection.history;

        pendingLoan.prevLoanFullPaymentDate = currentDate;
        pendingLoan.prevLoanFullPaymentAmount = collection.fullPayment;
        cashCollection.loanId = pendingLoan._id + "";
        cashCollection.currentReleaseAmount = pendingLoan.amountRelease;
        cashCollection.prevLoanId = currentLoan._id + "";

        const currentLoanId = currentLoan._id;
        const pendingLoanId = pendingLoan._id;
        const cashCollectionId = cashCollection._id;
        delete currentLoan._id;
        delete pendingLoan._id;
        delete cashCollection._id;
        logger.debug({page: `Saving Cash Collection - Updating Pending Loan`, currentLoan: currentLoan, pendingLoan: pendingLoan, cashCollection: collection});

        await graph.mutation(
          updateQl(loansType, {
            set: { ...currentLoan },
            where: { _id: { _eq: currentLoanId } }
          }),
          updateQl(loansType, {
            set: { ...pendingLoan },
            where: { _id: { _eq: pendingLoanId } }
          }),
          updateQl(ccType, {
            set: { ...cashCollection },
            where: { _id: { _eq: cashCollectionId } }
          })
        );
    }
}