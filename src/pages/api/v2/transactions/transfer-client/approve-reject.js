import { apiHandler } from "@/services/api-handler";
import moment from "moment";
import { findCashCollections, findLoans } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";
import {
  CASH_COLLECTIONS_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
  TRANSFER_CLIENT_FIELDS,
} from "@/lib/graph.fields";

const groupsType = createGraphType("groups", GROUP_FIELDS)();
const loansType = createGraphType("loans", LOAN_FIELDS)();
const clientType = createGraphType("client", CLIENT_FIELDS)();
const transferClientsType = createGraphType(
  "transferClients",
  TRANSFER_CLIENT_FIELDS
)();
const cashCollectionsType = createGraphType(
  "cashCollections",
  CASH_COLLECTIONS_FIELDS
)();

const graph = new GraphProvider();

export default apiHandler({
  post: approveReject,
});

async function approveReject(req, res) {
  const transfers = req.body;

  let groupFullError = false;
  const promise = await new Promise(async (resolve) => {
    const response = await Promise.all(
      transfers.map(async (transfer) => {
        if (transfer.status === "approved") {
          let client = { ...transfer.client };
          let loan = transfer.loans.length > 0 ? transfer.loans[0] : null;
          let sourceGroup = transfer.sourceGroup;
          let targetGroup = transfer.targetGroup;

          const sourceGroupId = sourceGroup._id;
          const targetGroupId = targetGroup._id;
          delete sourceGroup._id;
          delete targetGroup._id;

          const existingCashCollection = await findCashCollections({
            clientId: { _eq: client._id },
            groupId: { _eq: transfer.oldGroupId },
            dateAdded: { _eq: transfer.dateAdded },
          });

          targetGroup.noOfClients = targetGroup.noOfClients
            ? targetGroup.noOfClients
            : 0;
          if (targetGroup.status === "full") {
            groupFullError = true;
          } else {
            let selectedSlotNo = transfer.selectedSlotNo;
            if (selectedSlotNo !== "-") {
              // if slot is not available assigned new slot   slotNo = 1
              if (!targetGroup.availableSlots.includes(selectedSlotNo)) {
                // [6,7,8,9,10]
                // get always the first available slot
                selectedSlotNo = targetGroup.availableSlots[0];
              }

              targetGroup.availableSlots = targetGroup.availableSlots.filter(
                (s) => s !== selectedSlotNo
              );
              targetGroup.noOfClients = targetGroup.noOfClients + 1;

              if (targetGroup.noOfClients === targetGroup.capacity) {
                targetGroup.status = "full";
              }

              // put back the slotNo in the source group
              if (
                !sourceGroup.availableSlots.includes(transfer.currentSlotNo)
              ) {
                sourceGroup.availableSlots.push(transfer.currentSlotNo);
                sourceGroup.availableSlots.sort((a, b) => {
                  return a - b;
                });
              }
              sourceGroup.noOfClients = sourceGroup.noOfClients - 1;

              await graph.mutation(
                updateQl(groupsType, {
                  where: { _id: { _eq: sourceGroupId } },
                  set: { ...sourceGroup },
                })
              );
              await graph.mutation(
                updateQl(groupsType, {
                  where: { _id: { _eq: targetGroupId } },
                  set: { ...targetGroup },
                })
              );

              if (loan) {
                const loanId = loan._id;
                delete loan._id;
                let updatedLoan = { ...loan };
                updatedLoan.branchId = transfer.targetBranchId;
                updatedLoan.loId = transfer.targetUserId;
                updatedLoan.groupId = transfer.targetGroupId;
                updatedLoan.groupName = targetGroup.name;
                updatedLoan.slotNo = selectedSlotNo;
                updatedLoan.mcbuCollection = loan.mcbu;
                updatedLoan.transferId = transfer._id;
                updatedLoan.transfer = true;
                if (updatedLoan.status === "active") {
                  updatedLoan.startDate = moment(transfer.dateAdded)
                    .add(1, "days")
                    .format("YYYY-MM-DD");
                }
                updatedLoan.transferDate = transfer.dateAdded;
                updatedLoan.insertedDateTime = new Date();

                if (
                  updatedLoan.status === "completed" &&
                  updatedLoan.fullPaymentDate === transfer.dateAdded
                ) {
                  updatedLoan.fullPaymentDate = null;
                }

                if (existingCashCollection.length > 0) {
                  const prevLoanId = existingCashCollection[0].prevLoanId;
                  let prevLoan = await findLoans({ _id: { _eq: prevLoanId } });
                  if (prevLoan.length > 0) {
                    prevLoan = prevLoan[0];

                    if (
                      existingCashCollection[0].status === "tomorrow" ||
                      existingCashCollection[0].status === "pending"
                    ) {
                      prevLoan.transferredReleased = true;
                    }

                    if (existingCashCollection[0].status === "completed") {
                      updatedLoan.status = "completed";
                    }
                  }
                  delete prevLoan._id;
                  await graph.mutation(
                    updateQl(loansType, {
                      where: { _id: { _eq: prevLoanId } },
                      set: { ...prevLoan },
                    })
                  );
                }

                const newLoan = await graph
                  .mutation(
                    insertQl(loansType, { objects: [{ ...updatedLoan }] })
                  )
                  .catch((e) => ({ errors: [e] }));

                if (newLoan.data?.loans?.returing?.length) {
                  loan.status = "closed";
                  loan.transferred = true;
                  loan.transferId = transfer._id;
                  loan.transferredDate = transfer.dateAdded;
                  loan.modifiedDateTime = new Date();
                  await db
                    .collection("loans")
                    .updateOne(
                      { _id: new ObjectId(loanId) },
                      { $set: { ...loan } }
                    );
                  loan._id = newLoan.data.loans.returning[0]._id.toString();
                  loan.oldId = loanId;
                }
              }
            }

            client.branchId = transfer.targetBranchId;
            client.loId = transfer.targetUserId;
            client.groupId = transfer.targetGroupId;
            client.groupName = targetGroup.name;

            await saveCashCollection(
              transfer,
              client,
              loan,
              sourceGroup,
              targetGroup,
              selectedSlotNo,
              existingCashCollection
            );

            const updatedClient = { ...client };
            delete updatedClient._id;

            await graph.mutation(
              updateQl(clientType, {
                where: { _id: { _eq: client._id } },
                set: { ...updatedClient },
              })
            );

            await graph.mutation(
              updateQl(transferClientsType, {
                where: { _id: { _eq: transfer._id } },
                set: {
                  status: "approved",
                  occurence: sourceGroup.occurence,
                  approveRejectDate: transfer.dateAdded,
                  modifiedDateTime: new Date(),
                },
              })
            );
          }
        } else {
          await graph.mutation(
            updateQl(transferClientsType, {
              where: { _id: { _eq: transfer._id } },
              set: {
                status: "reject",
                modifiedDateTime: new Date(),
              },
            })
          );
        }
      })
    );

    resolve({ success: true });
  });

  let response;
  if (promise) {
    if (groupFullError) {
      response = {
        success: true,
        message:
          "Some client were not successfuly transfered due to selected group is full.",
      };
    } else {
      response = { success: true };
    }
  }

  res.send(response);
}

async function saveCashCollection(
  transfer,
  client,
  loan,
  sourceGroup,
  targetGroup,
  selectedSlotNo,
  existingCashCollection
) {
  // add new cash collection entry with updated data
  const cashCollection = await findCashCollections({
    clientId: { _eq: client._id },
    groupId: { _eq: client.groupId },
    dateAdded: { _eq: transfer.dateAdded },
  });

  if (cashCollection.length === 0) {
    let data = {
      branchId: transfer.targetBranchId,
      groupId: transfer.targetGroupId,
      loId: transfer.targetUserId,
      clientId: client._id,
      mispayment: false,
      mispaymentStr: "No",
      collection: 0,
      excess: 0,
      total: 0,
      activeLoan: 0,
      targetCollection: 0,
      amountRelease: 0,
      loanBalance: 0,
      paymentCollection: 0,
      occurence: targetGroup.occurence,
      currentReleaseAmount: 0,
      fullPayment: 0,
      mcbu: 0,
      mcbuCol: 0,
      mcbuWithdrawal: 0,
      mcbuReturnAmt: 0,
      remarks: null,
      dateAdded: transfer.dateAdded,
      groupStatus: "closed",
      transferId: transfer._id,
      transferDate: transfer.dateAdded,
      sameLo: transfer.sameLo,
      transfer: true,
      loToLo: transfer.loToLo,
      branchToBranch: transfer.branchToBranch,
      insertedDateTime: new Date(),
      origin: "automation-trf",
    };

    if (loan) {
      data.oldLoanId = loan.oldId;
      data.loanId = loan._id;
      data.activeLoan = loan.activeLoan;
      data.targetCollection = loan.activeLoan;
      data.amountRelease = loan.amountRelease;
      data.loanBalance = loan.loanBalance;
      data.slotNo = selectedSlotNo;
      data.loanCycle = loan.loanCycle;
      data.noOfPayments = loan.noOfPayments;
      data.mcbu = loan.mcbu;
      data.pastDue = loan.pastDue;
      data.noPastDue = loan.noPastDue;
      data.loanTerms = loan.loanTerms;
      data.remarks =
        existingCashCollection.length > 0
          ? existingCashCollection[0].remarks
          : null;
      data.status =
        existingCashCollection.length > 0
          ? existingCashCollection[0].status
          : null;

      if (data.occurence === "weekly") {
        // data.mcbuTarget = 50;
        data.groupDay = targetGroup.groupDay;
      }
    }

    await graph.mutation(
      insertQl(cashCollectionsType, { objects: [{ ...data }] })
    );
  } else {
    await graph.mutation(
      updateQl(cashCollectionsType, {
        where: { _id: { _eq: cashCollection[0]._id } },
        set: {
          transfer: true,
          sameLo: transfer.sameLo,
          transferId: transfer._id,
          transferDate: transfer.dateAdded,
          loToLo: transfer.loToLo,
          branchToBranch: transfer.branchToBranch,
          modifiedDateTime: new Date(),
        },
      })
    );
  }

  // add or update client data on cash collection
  if (existingCashCollection.length === 0) {
    let data = {
      branchId: transfer.oldBranchId,
      groupId: transfer.oldGroupId,
      loId: transfer.oldLoId,
      clientId: client._id,
      mispayment: false,
      mispaymentStr: "No",
      collection: 0,
      excess: 0,
      total: 0,
      activeLoan: 0,
      targetCollection: 0,
      amountRelease: 0,
      loanBalance: 0,
      paymentCollection: 0,
      occurence: sourceGroup.occurence,
      currentReleaseAmount: 0,
      fullPayment: 0,
      mcbu: 0,
      mcbuCol: 0,
      mcbuWithdrawal: 0,
      mcbuReturnAmt: 0,
      remarks: "",
      dateAdded: transfer.dateAdded,
      groupStatus: "closed",
      transferId: transfer._id,
      transferredDate: transfer.dateAdded,
      sameLo: transfer.sameLo,
      transferred: true,
      loToLo: transfer.loToLo,
      branchToBranch: transfer.branchToBranch,
      insertedDateTime: new Date(),
      origin: "automation-trf",
    };

    if (loan) {
      data.loanId = loan.oldId;
      data.activeLoan = loan.activeLoan;
      data.targetCollection = loan.activeLoan;
      data.amountRelease = loan.amountRelease;
      data.loanBalance = loan.loanBalance;
      data.slotNo = loan.slotNo;
      data.loanCycle = loan.loanCycle;
      data.noOfPayments = loan.noOfPayments;
      data.status = loan.status;
      data.mcbu = loan.mcbu;
      data.loanTerms = loan.loanTerms;
      data.remarks = loan?.history?.remarks;
    }

    if (data.occurence === "weekly") {
      data.mcbuTarget = 50;
      data.groupDay = sourceGroup.groupDay;
    }

    await graph.mutation(
      insertQl(cashCollectionsType, { objects: [{ ...data }] })
    );
  } else {
    await graph.mutation(
      updateQl(cashCollectionsType, {
        where: { _id: { _eq: existingCashCollection[0]._id } },
        set: {
          transferred: true,
          sameLo: transfer.sameLo,
          transferId: transfer._id,
          transferredDate: transfer.dateAdded,
          loToLo: transfer.loToLo,
          branchToBranch: transfer.branchToBranch,
          modifiedDateTime: new Date(),
        },
      })
    );
  }
}
