import { apiHandler } from "@/services/api-handler";
import logger from "@/logger";
import {
  createGraphType,
  insertQl,
  queryQl,
  updateQl,
} from "@/lib/graph/graph.util";
import {
  CASH_COLLECTIONS_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  filterGraphFields,
  findCashCollections,
  findClients,
  findLoans,
} from "@/lib/graph.functions";
import { generateUUID } from "@/lib/utils";
import moment from "moment";
import { getCurrentDate, getCurrentDateV2, getEndDate } from "@/lib/date-utils";
import { isNotificationEnabled, notifyLoanCreated } from '@/lib/notification-service';
import { findUserById, findBranches } from '@/lib/graph.functions';

const loanType = createGraphType("loans", LOAN_FIELDS);
const groupType = createGraphType("groups", GROUP_FIELDS);
const clientType = createGraphType("client", CLIENT_FIELDS);
const cashCollectionType = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS);
const graph = new GraphProvider();

export default apiHandler({
  post: processData,
});

/**
 * Create notification for loan approval
 * @param {Object} loan - Loan data
 * @param {string} loanId - Loan ID
 * @param {string} user_id - User ID who approved the loan
 */
async function createLoanApprovalNotification(loan, loanId, user_id) {
    try {
        const user = await findUserById(user_id);
        const branches = await findBranches({ _id: { _eq: loan.branchId } });
        const branch = branches?.[0];

        if (branch) {
            const isReloan = loan.loanCycle > 1;
            
            await notifyLoanCreated({
                clientName: loan.fullName,
                clientId: loan.clientId,
                loanId: loanId,
                amount: loan.principalLoan || loan.amountRelease,
                groupId: loan.groupId,
                groupName: loan.groupName,
                branchId: loan.branchId,
                areaId: branch.areaId,
                regionId: branch.regionId,
                divisionId: branch.divisionId,
                loId: loan.loId,
                createdBy: user?._id || user_id,
                createdByName: user ? `${user.firstName} ${user.lastName}` : 'System',
                isReloan: isReloan,
                loanCycle: loan.loanCycle
            });

            logger.debug({
                page: 'Loan Approval',
                message: `Notification created for ${isReloan ? 'reloan' : 'new loan'}`,
                loanId: loanId,
                clientId: loan.clientId
            });
        }
    } catch (error) {
        logger.error({
            page: 'Loan Approval',
            message: 'Failed to create loan notification',
            error: error.message,
            loanId: loanId
        });
    }
}

async function processData(req, res) {
  const mutationList = [];
  const addToMutationList = addToList => mutationList.push(addToList(`bulk_update_${mutationList.length}`));

  let response = {};
  const errorMsg = [];

  let { loanData, origin } = req.body;

  if (origin === "ldf") {
    const promise = await new Promise(async (resolve) => {
      const response = await Promise.all(
        loanData.map(async (loan) => {
          const loanId = loan._id;
          const currentDate = loan.currentDate || moment(getCurrentDateV2()).format("YYYY-MM-DD");
          logger.debug({ page: `LDF Approved Loan: ${loanId}` });
          delete loan._id;
          delete loan.loanOfficer;
          delete loan.groupCashCollections;
          delete loan.loanReleaseStr;
          delete loan.allowApproved;
          delete loan.currentDate;
          delete loan.groupStatus;
          delete loan.pendings;
          delete loan.origin;
          delete loan.hasActiveLoan;

          const active = await findLoans({
            clientId: { _eq: loan.clientId },
            status: { _in: ["active", "completed"] },
          });

          if (active.length > 0) {
              const error = `Client ${active[0].fullName} with slot ${active[0].slotNo} of group ${active[0].groupName}, still have active loan.`;
              errorMsg.push(error);
          } else {
              // Set LDF approval fields
              loan.ldfApproved     = true;
              loan.ldfApprovedDate = currentDate;
              await updateLoan(loanId, loan, addToMutationList);
          }
        })
      );

      resolve(response);
    });

    if (promise) {

      if(mutationList.length && errorMsg.length == 0) {

        await graph.mutation(
          ... mutationList,
        );
      }

      response = {
        success: true,
        withError: errorMsg.length > 0,
        errorMsg: errorMsg,
      };
    }
  } else {
    const isNotificationEnabledFlag = await isNotificationEnabled();
    const result = await Promise.all(
      loanData.map(async (l) => {
        let loan = { ...l };

        const active = await findLoans({
          clientId: { _eq: loan.clientId },
          status: { _in: ["active", "completed"] },
        });
        if (active.length > 0) {
          const error = `Client ${active[0].fullName} with slot ${active[0].slotNo} of group ${active[0].groupName}, still have active loan.`;
          errorMsg.push(error);
        } else {
          const loanId = loan._id;
          const currentDate = moment(getCurrentDate()).format("YYYY-MM-DD");
          logger.debug({ page: `Approving Loan: ${loanId}`, data: loan });
          delete loan._id;
          delete loan.loanOfficer;
          delete loan.groupCashCollections;
          delete loan.loanReleaseStr;
          delete loan.allowApproved;
          delete loan.currentDate;
          delete loan.groupStatus;
          delete loan.pendings;
          delete loan.origin;
          delete loan.hasActiveLoan;
          delete loan.hasTdaLoan;
          delete loan.transactionClosed;
          delete loan.selected;
          delete loan.profile;
          delete loan.clientName;
          delete loan.branch;
          delete loan.client;
          delete loan.loanOfficer;
          delete loan.group;
          delete loan.selected;
          delete loan.profile;
          delete loan.principalLoanStr;
          delete loan.mcbuStr;
          delete loan.activeLoanStr;
          delete loan.loanBalanceStr;
          delete loan.loanReleaseStr;
          delete loan.allowApproved;
          delete loan.hasActiveLoan;
          delete loan.hasTdaLoan;
          delete loan.transactionClosed;

          let groupData = await checkGroupStatus(loan.groupId);
          if (groupData.length > 0) {
            groupData = groupData[0];

            if (loan.status === "active") {
              await updateClient(loan, addToMutationList);

              if (loan.coMaker) {
                if (typeof loan.coMaker === "string") {
                  loan.coMakerId = loan.coMaker;
                  const coMakerResp = await getCoMakerInfo(
                    loan.coMaker,
                    loan.groupId
                  );
                  if (coMakerResp.success) {
                    loan.coMaker = coMakerResp.client;
                  }
                } else if (typeof loan.coMaker === "number") {
                  const coMakerResp = await getCoMakerInfo(
                    loan.coMaker,
                    loan.groupId
                  );
                  if (coMakerResp.success) {
                    loan.coMakerId = coMakerResp.client;
                  }
                }
              }
            }

            if (loan.status === "active") {
              logger.debug({
                page: `Loan: ${loan._id}`,
                message: "Updating loan data.",
                status: loan.status,
              });

              loan.dateAdded = currentDate;
              loan.dateGranted = currentDate
              loan.startDate = moment(currentDate).add(1, 'days').format('YYYY-MM-DD');
              loan.loanTerms = loan.loanTerms ? loan.loanTerms : groupData.occurence == 'daily' ? 60 : 24;
              loan.endDate = getEndDate(currentDate, loan.loanTerms);

              await updateLoan(loanId, { ... loan }, addToMutationList);
              
              loan._id = loanId;
              
              await saveCashCollection(loan, groupData, currentDate, addToMutationList);
              if (isNotificationEnabledFlag) {
                await createLoanApprovalNotification(loan, loanId, req?.auth?.sub);
              }
            } else if (loan.status === "pending" && loan.preApproved) {
              logger.debug({
                page: `Loan: ${loan._id}`,
                message: "Updating loan data pre approval.",
                status: loan.status,
              });

              await updateLoan(loanId, { ... loan }, addToMutationList);
            }
          }
        }
      })
    );

    if(mutationList.length && errorMsg.length == 0) {

      await graph.mutation(
        ... mutationList,
      );
    }

    if (result) {
      response = {
        success: true,
        withError: errorMsg.length > 0,
        errorMsg: errorMsg,
      };
    }
  }

  res.send(response);
}

async function updateLoan(loanId, loan, addToMutationList) {
  addToMutationList(alias => updateQl(loanType(alias), {
    set: filterGraphFields(LOAN_FIELDS, { 
      ...loan, 
      coMaker: loan.coMaker ? loan.coMaker.toString() : null,
      ldfApprovedDate: loan.ldfApprovedDate || null,
    }),
    where: { _id: { _eq: loanId } },
  }));
}

async function checkGroupStatus(groupId) {
  return (
    (
      await graph.query(
        queryQl(groupType(), { where: { _id: { _eq: groupId } } })
      )
    ).data?.groups ?? []
  );
}

async function updateGroup(group, addToMutationList) {
  const groupId = group._id;
  delete group._id;

  addToMutationList(alias => updateQl(groupType(alias), {
    where: { _id: { _eq: groupId } },
    set: { ...group },
  }))

  return { success: true, groupResp };
}

async function updateClient(loan, addToMutationList) {
  let [client] = await findClients({ _id: { _eq: loan?.clientId ?? null } });

  if (!!client) {

    client.dateModified = moment(getCurrentDate()).format('YYYY-MM-DD');

    if (client.status === "offset") {
      client.status = "active";
      client.groupName = loan?.groupName;
      client.groupId = loan.groupId;
      client.branchId = loan.branchId;
      client.loId = loan.loId;
      client.oldGroupId = null;
      client.oldLoId = null;
      
    }

    const clientId = client._id;
    client.status = "active";
    delete client._id;

    addToMutationList(alias => updateQl(clientType(alias), {
      where: { _id: { _eq: clientId } },
      set: filterGraphFields(CLIENT_FIELDS, { ...client }),
    }));
  }

  return { success: true, client };
}

async function getCoMakerInfo(coMaker, groupId) {
  let client;
  if (typeof coMaker === "number" || !isNaN(coMaker)) {
    const loan = await findLoans({
      groupId: { _eq: groupId },
      status: { _in: ["active", "pending"] },
      slotNo: { _eq: +coMaker },
    });

    if (loan && loan.length > 0) {
      client = loan[0].clientId;
    }
  } else if (typeof coMaker === "string") {
    const loan = await findLoans({
      clientId: { _eq: coMaker },
      status: { _in: ["active", "pending"] },
    });

    if (loan && loan.length > 0) {
      client = loan[0].slotNo;
    }
  }

  return { success: true, client };
}

async function saveCashCollection(loan, group, currentDate, addToMutationList) {
  const status = loan.status === "active" ? "tomorrow" : loan.status;
  let cashCollection = await findCashCollections({
    clientId: { _eq: loan.clientId },
    groupId: { _eq: loan.groupId },
    dateAdded: { _eq: currentDate },
  });
  logger.debug({
    page: `Loan: ${loan._id}`,
    message: "Saving/Updating cashCollection data.",
    data: cashCollection,
  });
  if (cashCollection.length > 0) {
    logger.debug({ page: `Loan: ${loan._id}`, message: "Updating loan data." });
    cashCollection = cashCollection[0];
    const ccId = cashCollection._id;
    delete cashCollection._id;

    addToMutationList(alias => updateQl(cashCollectionType(alias), {
      where: { _id: { _eq: ccId } },
      set: filterGraphFields(CASH_COLLECTIONS_FIELDS, {
        ...cashCollection,
        status: status,
        loanCycle: loan.loanCycle,
        modifiedDate: currentDate,
        admissionCollection: loan.admissionCollection,
        lrfCollection: loan.lrfCollection,
        cbhbCollection: loan.cbhbCollection,
        addHospitalization: loan.addHospitalization,
        otherPassbookCollection: loan.otherPassbookCollection,
        otherPictureCollection: loan.otherPictureCollection,
        csf: loan.csf,
        loanId: loan._id, // update the cash collection to the new loan
      }),
    }));
  } else {
    // this entry is only when the approve or reject is not the same day when it applies

    const mcbu = loan.mcbu ? loan.mcbu : 0;

    let data = {
      _id: generateUUID(),
      loanId: loan._id + "",
      branchId: loan.branchId,
      groupId: loan.groupId,
      groupName: loan.groupName,
      loId: loan.loId,
      clientId: loan.clientId,
      slotNo: loan.slotNo,
      loanCycle: loan.loanCycle,
      mispayment: false,
      mispaymentStr: "No",
      collection: 0,
      excess: 0,
      total: 0,
      noOfPayments: 0,
      activeLoan: loan.activeLoan,
      targetCollection: loan.activeLoan,
      amountRelease: loan.amountRelease,
      loanBalance: loan.loanBalance,
      paymentCollection: 0,
      occurence: group.occurence,
      currentReleaseAmount: loan.amountRelease,
      fullPayment: 0,
      remarks: loan?.history?.remarks,
      mcbu: mcbu,
      mcbuCol: loan?.groupLeader ? mcbu : 0,
      mcbuWithdrawal: 0,
      mcbuReturnAmt: 0,
      admissionCollection: loan.admissionCollection,
      lrfCollection: loan.lrfCollection,
      cbhbCollection: loan.cbhbCollection,
      addHospitalization: loan.addHospitalization,
      otherPassbookCollection: loan.otherPassbookCollection,
      otherPictureCollection: loan.otherPictureCollection,
      csf: loan.csf,
      csfCollection: 0,
      csfWithdrawal: 0,
      csfReturnAmt: 0,
      status: status,
      dateAdded: currentDate,
      groupStatus: "closed",
      origin: "automation-ar-loan",
    };

    if (data.loanCycle === 1 && data.occurence === "weekly") {
      data.mcbuCol = loan.mcbu;
    }

    if (data.occurence === "weekly") {
      data.mcbuTarget = 50;
      data.groupDay = group.day;
    }
    logger.debug({
      page: `Loan: ${loan._id}`,
      message: "Adding loan data.",
      data: data,
    });

    addToMutationList(alias => insertQl(cashCollectionType(alias), { objects: [filterGraphFields(CASH_COLLECTIONS_FIELDS, { ...data })] }));
  }
}
