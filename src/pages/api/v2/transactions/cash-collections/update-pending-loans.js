import { apiHandler } from "@/services/api-handler";
import moment from "moment";
import logger from "@/logger";
import { getCurrentDate } from "@/lib/date-utils";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, updateQl } from "@/lib/graph/graph.util";
import { findCashCollections, findGroups, findLoans } from "@/lib/graph.functions";

const graph = new GraphProvider();
const loansType = createGraphType('loans', '_id');
const ccType = createGraphType('cashCollections', '_id')();
const groupType = createGraphType('groups', '_id');

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
    // console.log("logs", user_id, cc.clientId, cc.loanId, cc.loanFor, cc, currentDate );
    if ((cc?.loanFor === 'today' || (cc?.loanFor === 'tomorrow' && cc?.dateOfRelease === currentDate))) {
        let updatedCc = { ... cc };
        // console.log('loanId', loanId)
        if (loanId) {
          updatedCc.loanId = loanId;
        }
        await updatePendingLoan(user_id, updatedCc, currentDate);
    } else {
      // console.log('loanId', loanId)
      if (loanId) {
        await graph.mutation(
          updateQl(loansType(), {
            set: { status: 'closed', closedDate: currentDate },
            where: { _id: { _eq: loanId } }
          }),
          updateQl(ccType, {
            set: { status: 'closed' },
            where: {
              clientId: { _eq: cc.clientId },
              dateAdded: { _eq: currentDate },
            }
          })
        );
      } else {
        let ccLoanId = cc.loanId ? cc.loanId : cc._id;
        await graph.mutation(
          updateQl(loansType(), {
            set: { status: 'completed' },
            where: { _id: { _eq: ccLoanId } }
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
    // Reloaner path: the current loan may only be closed on/after the pending loan's release date.
    // (The offset path below is unaffected: an offset closes the current loan itself, so the pending
    // loan must be closed with it regardless of its release date.)
    const releaseDue = !(pendingLoan.length > 0 && pendingLoan[0].dateOfRelease
        && moment(pendingLoan[0].dateOfRelease).isAfter(moment(currentDate), 'day'));
    if (currentLoan.length > 0 && pendingLoan.length > 0 && cashCollection.length > 0 && releaseDue) {
        currentLoan = currentLoan[0];
        pendingLoan = pendingLoan[0];
        cashCollection = cashCollection[0];

        // Reloan of a client who was already completed: the LOR row may still be an untouched
        // pre-save placeholder (no history / remarks / fullPaymentDate). Never close the old loan
        // from blanks - recover the real payoff date from the client's earlier cashCollections.
        const payoffDate = currentLoan.fullPaymentDate
            || cashCollection.fullPaymentDate
            || await findLastPayoffDate(currentLoan.clientId, currentDate);
        const wasCompleted = Number(currentLoan.loanBalance) <= 0 || currentLoan.status === 'completed';
        const reloanerRemark = { label: 'Reloaner', value: currentLoan.occurence === 'daily' ? 'reloaner-cont' : 'reloaner' };
        const baseHistory = cashCollection.history || currentLoan.history || {};
        const closedHistory = {
            ...baseHistory,
            amountRelease: baseHistory.amountRelease ?? (Number(currentLoan.amountRelease) || 0),
            ...(wasCompleted && !baseHistory.remarks?.value ? { remarks: reloanerRemark } : {}),
        };
        const ccNeedsReloanerRemark = wasCompleted && (!cashCollection.remarks || cashCollection.remarks === '-');

        const toUpdatePendingLoan = {
          advanceTransaction: true,
          mcbu: cashCollection.mcbu,
          csf: cashCollection.csf,
          prevLoanFullPaymentDate: payoffDate || currentDate,
          prevLoanFullPaymentAmount: Number(cashCollection.fullPayment) > 0 ? cashCollection.fullPayment : (Number(currentLoan.history?.amountRelease) || Number(currentLoan.amountRelease) || 0),
          mcbuWithdrawal: cashCollection.mcbuWithdrawal,
          csfWithdrawal: cashCollection.csfWithdrawal,
        };

        const toUpdateCurrentLoan = {
          status: 'closed',
          loanBalance: 0,
          amountRelease: 0,
          activeLoan: 0,
          mcbu: 0,
          csf: 0,
          mcbuCollection: cashCollection.mcbu,
          noOfPayments: cashCollection.noOfPayments,
          fullPaymentDate:  payoffDate,
          mcbuWithdrawal: cashCollection.mcbuWithdrawal,
          mcbuReturnAmt: cashCollection.mcbuReturnAmt,
          csfWithdrawal: cashCollection.csfWithdrawal,
          csfReturnAmt: cashCollection.csfReturnAmt,
          history: closedHistory,
          advanceTransaction: false
        };

        const toUpdateCollection = {
          loanId: pendingLoan._id,
          currentReleaseAmount: pendingLoan.amountRelease,
          prevLoanId: currentLoan._id,
          ...(ccNeedsReloanerRemark ? { remarks: reloanerRemark } : {}),   // cashCollections.remarks is jsonb: store the object
          admissionCollection: pendingLoan.admissionCollection,
          lrfCollection: pendingLoan.lrfCollection,
          cbhbCollection: pendingLoan.cbhbCollection,
          addHospitalization: pendingLoan.addHospitalization,
          otherPassbookCollection: pendingLoan.otherPassbookCollection,
          otherPictureCollection: pendingLoan.otherPictureCollection,
          status: pendingLoan.status === 'active' ? 'tomorrow' : pendingLoan.status,
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

      // Offset: the current loan was closed by the offset itself, so the pending loan is rejected
      // (same end state as loans/reject.js for a reloan: loanCycle 0, group slot freed). The previous
      // loan is NOT reopened here - reject.js would put it back to completed/active.
      const toUpdatePendingLoan = {
        status: "reject",
        loanCycle: 0,
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

      const rejectMutations = [
        updateQl(loansType('pending'), {
          set: { ... toUpdatePendingLoan },
          where: { _id: { _eq: pendingLoanId } }
        }),
        updateQl(ccType, {
          set: { ... toUpdateCollection },
          where: { _id: { _eq: cashCollectionId } }
        })
      ];

      // free the group slot, only if it is not already free (the offset may have freed it)
      const [group] = await findGroups({ _id: { _eq: pendingLoan.groupId } });
      if (group && Array.isArray(group.availableSlots) && !group.availableSlots.includes(pendingLoan.slotNo)) {
        rejectMutations.push(updateQl(groupType('group'), {
          set: {
            availableSlots: [...group.availableSlots, pendingLoan.slotNo].sort((a, b) => a - b),
            noOfClients: group.noOfClients - 1,
            status: group.status === 'full' ? 'available' : group.status,
          },
          where: { _id: { _eq: group._id } }
        }));
      }

      await graph.mutation(
        ...rejectMutations
      ).catch(err => {
        logger.error(err);
        throw err;
      })
    }
}

// Most recent payoff date recorded on any of the client's cashCollections (covers loans that were
// transferred, where the loan row lost fullPaymentDate but the daily/weekly rows kept it).
async function findLastPayoffDate(clientId, currentDate) {
    const rows = await findCashCollections({
        clientId: { _eq: clientId },
        fullPaymentDate: { _is_null: false },
        dateAdded: { _lte: currentDate },
    }, 'dateAdded fullPaymentDate');
    const dates = rows.map(r => String(r.fullPaymentDate).slice(0, 10)).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
}
