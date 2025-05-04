import { apiHandler } from "@/services/api-handler";
import moment from "moment";
import logger from "@/logger";
import { getCurrentDate } from "@/lib/date-utils";
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
    await savePendingLoans(req?.auth?.sub, data)
    res.send({ success: true });
}

export async function savePendingLoans(user_id, collections, loanId) {
  logger.debug({user_id, page: `Update Cash Collection For Pending Loans`, cashCollectionsFromFrontEnd: collections});
  const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
  await Promise.all(collections.map(async cc => {
    logger.debug({user_id, page: `Update Cash Collection For Pending Loan savePendingLoans`, clientId: cc.clientId, loanId: cc.loanId, cc, currentDate });
    if ((cc?.loanFor === 'today' || (cc?.loanFor === 'tomorrow' && cc?.dateOfRelease === currentDate))) {
        let updatedCc = { ... cc };;
        if (loanId) {
          updatedCc.loanId = loanId;
        }
        await updatePendingLoan(user_id, updatedCc, currentDate);
    } else {
      let ccLoanId = cc.loanId ? cc.loanId : cc._id;
      let ccStatus = 'completed';

      if (loanId) {
        ccLoanId = loanId;
        ccStatus = 'closed'
      }
        await graph.mutation(
          updateQl(loansType(), {
            set: { status: ccStatus },
            where: { _id: { _eq: ccLoanId } }
          }),
          updateQl(ccType, {
            set: { status: ccStatus },
            where: {
              clientId: { _eq: cc.clientId },
              dateAdded: { _eq: currentDate },
            }
          })
        );
    }
  }))
}

async function updatePendingLoan(user_id, collection, currentDate) {
    logger.debug({user_id, page: `Saving Cash Collection - Updating Pending Loan: ${collection.loanId}`, currentDate: currentDate});

    let currentLoan = await findLoans({
      clientId: { _eq: collection.clientId },
      status: { _in: ["active", "completed"] },
    });
    let currentLoanClosed = await findLoans({
      clientId: { _eq: collection.clientId },
      status: { _eq: "closed" },
      closedDate: { _eq: currentDate },
    });
    let pendingLoan = await findLoans({
      clientId: { _eq: collection.clientId },
      status: { _eq: "pending" },
    });

    let cashCollection = await findCashCollections({
      clientId: { _eq: collection.clientId },
      dateAdded: { _eq: currentDate },
    });
    
    logger.debug({user_id, page: `Saving Cash Collection - Updating Pending Loan Sizes: ${collection.loanId}`, currentLoanSize: currentLoan.length, pendingLoanSize: pendingLoan.length, cashCollectionSize: cashCollection.length});
    logger.debug({user_id, page: `Saving Cash Collection - Updating Pending Loan CurrentLoans: ${collection.loanId}`, clientId: currentLoan.clientId, loanId: currentLoan._id,  currentLoan: currentLoan, currentLoanClosed: currentLoanClosed});
    // console.log('lengths: ', currentLoan.length, pendingLoan.length, cashCollection.length > 0)
    if (currentLoan.length > 0 && pendingLoan.length > 0 && cashCollection.length > 0) {
        currentLoan = currentLoan[0];
        pendingLoan = pendingLoan[0];
        cashCollection = cashCollection[0];

        const toUpdatePendingLoan = {
          advanceTransaction: true,
          mcbu: cashCollection.mcbu,
          prevLoanFullPaymentDate: currentDate,
          prevLoanFullPaymentAmount: cashCollection.fullPayment,
          mcbuWithdrawal: cashCollection.mcbuWithdrawal
        };

        const toUpdateCurrentLoan = {
          status: 'closed',
          loanBalance: 0,
          amountRelease: 0,
          activeLoan: 0,
          mcbu: 0,
          mcbuCollection: cashCollection.mcbu,
          noOfPayments: cashCollection.noOfPayments,
          fullPaymentDate:  cashCollection.fullPaymentDate,
          mcbuWithdrawal: cashCollection.mcbuWithdrawal,
          mcbuReturnAmt: cashCollection.mcbuReturnAmt,
          history: cashCollection.history,
          advanceTransaction: false
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

        logger.debug({user_id, page: `Saving Cash Collection - Updating Pending Loan`, currentLoan: toUpdateCurrentLoan, pendingLoan: toUpdatePendingLoan, cashCollection: toUpdateCollection });

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
    } else if (currentLoanClosed.length > 0 && pendingLoan.length > 0 && cashCollection.length > 0) {
      currentLoanClosed = currentLoanClosed[0];
      pendingLoan = pendingLoan[0];
      cashCollection = cashCollection[0];

      logger.debug({user_id, page: `Saving Cash Collection - Updating Pending Loan CLOSED`, message: 'Current Loan is already closed', currentLoanClosed: currentLoanClosed});

      const toUpdatePendingLoan = {
        status: "closed",
        remarks: "Previous loan is already closed"
      };

      const toUpdateCollection = {
        currentReleaseAmount: 0,
        prevLoanId: "",
        status: 'closed',
      };

      const pendingLoanId = pendingLoan._id;
      const cashCollectionId = cashCollection._id;
      
      delete pendingLoan._id;
      delete cashCollection._id;

      await graph.mutation(
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