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

const loanType = createGraphType("loans", LOAN_FIELDS);
const groupType = createGraphType("groups", GROUP_FIELDS);
const clientType = createGraphType("clients", CLIENT_FIELDS);
const cashCollectionType = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS);
const graph = new GraphProvider();

export default apiHandler({
  post: processData,
});

async function processData(req, res) {

  const mutationList = [];
  const addToMutationList = addToList => mutationList.push(addToList(`bulk_update_${mutationList.length}`));

  let response = {};
  const errorMsg = [];

  let loanData = req.body;

  const origin = loanData && loanData.length > 0 && loanData[0].origin;

  if (origin === "ldf") {
    const promise = await new Promise(async (resolve) => {
      const response = await Promise.all(
        loanData.map(async (loan) => {
          const loanId = loan._id;
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
            await updateLoan(loanId, loan, addToMutationList);
          }
        })
      );

      resolve(response);
    });

    if (promise) {
      await graph.mutation(
        ... mutationList,
      );

      response = {
        success: true,
        withError: errorMsg.length > 0,
        errorMsg: errorMsg,
      };
    }
  } else {
    const result = await Promise.all(
      loanData.map(async (loan) => {
        const active = await findLoans({
          clientId: { _eq: loan.clientId },
          status: { _in: ["active", "completed"] },
        });
        if (active.length > 0) {
          const error = `Client ${active[0].fullName} with slot ${active[0].slotNo} of group ${active[0].groupName}, still have active loan.`;
          errorMsg.push(error);
        } else {
          const loanId = loan._id;
          const currentDate = loan.currentDate;
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
            } else if (loan.status === "reject") {
              if (!groupData.availableSlots.includes(loan.slotNo)) {
                groupData.availableSlots.push(loan.slotNo);
                groupData.availableSlots.sort((a, b) => {
                  return a - b;
                });
                groupData.noOfClients = groupData.noOfClients - 1;
                groupData.status =
                  groupData.status === "full"
                    ? "available"
                    : groupData.status;
                await updateGroup(groupData, addToMutationList);
              }
            }

            if (loan.status === "active" || loan.status === "reject") {
              logger.debug({
                page: `Loan: ${loan._id}`,
                message: "Updating loan data.",
                status: loan.status,
              });
              await updateLoan(loanId, { ... loan, status: 'active' }, addToMutationList);
              loan._id = loanId;
              await saveCashCollection(loan, groupData, currentDate, addToMutationList);
            }
          }
        }
      })
    );

    await graph.mutation(
      ... mutationList,
    );

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
    set: filterGraphFields(LOAN_FIELDS, { ...loan, coMaker: loan.coMaker + "" }),
    where: { _id: { _eq: loanId } },
  }));
}

async function checkGroupStatus(groupId) {
  return (
    (
      await graph.query(
        queryQl(groupType, { where: { _id: { _eq: groupId } } })
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
  const clientId = loan.clientId;
  let client = await findClients({ _id: { _eq: clientId } });
  if (client.length > 0) {
    client = client[0];

    if (client.status === "offset") {
      client.status = "active";
      client.groupName = loan?.groupName;
      client.groupId = loan.groupId;
      client.branchId = loan.branchId;
      client.loId = loan.loId;
      client.oldGroupId = null;
      client.oldLoId = null;
    }

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
      }),
    }));
  } else {
    // this entry is only when the approve or reject is not the same day when it applies
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
      mcbu: loan.mcbu ? loan.mcbu : 0,
      mcbuCol: 0,
      mcbuWithdrawal: 0,
      mcbuReturnAmt: 0,
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
