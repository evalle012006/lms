import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  CASH_COLLECTIONS_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
  TRANSFER_CLIENT_FIELDS,
} from "@/lib/graph.fields";
import { findLoans, findTransferClients } from "@/lib/graph.functions";
import { createGraphType, deleteQl, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const loansType = createGraphType('loans', '_id')();
const ccType = createGraphType('cashCollections', '_id')();
const transferClientsType = createGraphType('transferClients', '_id')();
const clientType = createGraphType('client', '_id')();
const groupsType = createGraphType('groups', '_id')();

const transferFields = `
 ${TRANSFER_CLIENT_FIELDS}
 loans {${LOAN_FIELDS}}
 cashCollections {${CASH_COLLECTIONS_FIELDS}}
 originalGroup: sourceGroup {${GROUP_FIELDS}}
 newGroup: targetGroup {${GROUP_FIELDS}}
`;

export default apiHandler({
  post: revertTransfer,
});

async function revertTransfer(req, res) {
    const { transferId } = req.body;
    const transfer = await findTransferClients({ _id: { _eq: transferId }}, transferFields);
    let response;
    
    if (transfer.length > 0) {
        const transferData = transfer[0];
        let originalLoan = transferData.loans.find(loan => loan.transferred === true);
        const newLoan = transferData.loans.find(loan => loan.transfer === true);
        let originalCC = transferData.cashCollections.find(cc => cc.transferred === true);
        const newCC = transferData.cashCollections.find(cc => cc.transfer === true);
        let originalGroup = transferData.originalGroup;
        let newGroup = transferData.newGroup;

        let prevLoan = await findLoans({ _id: { _eq: originalCC?.prevLoanId } });
        if (prevLoan.length > 0) {
            prevLoan = prevLoan[0];
            delete prevLoan.transferredReleased;
            delete prevLoan._id;
            await graph.mutation(updateQl(loansType, {
              where: { _id: { _eq: originalCC.prevLoanId }},
              set: {
                transferredReleased: null,
                ...prevLoan,
              }
            }));
        }

        originalLoan.status = originalCC.status !== 'pending' ? originalCC.status !== 'completed' ? 'active' : 'completed' : 'pending';
        originalLoan.revertedTransfer = true;

        delete originalLoan.transferred;
        delete originalLoan.transferId;

        const originalLoanId = originalLoan._id;
        delete originalLoan._id;
        await graph.mutation(updateQl(loansType, {
          where: { _id: { _eq: originalLoanId } },
          set: {
            transferred: null,
            transferId: null,
            ...originalLoan,
          }
        }));

        delete originalCC.transferred;
        delete originalCC.sameLo;
        delete originalCC.transferId;
        delete originalCC.loToLo;
        delete originalCC.branchToBranch;

        const originalCCId = originalCC._id;
        delete originalCC._id;
        await graph.mutation(updateQl(ccType, {
          where: { _id: { _eq: originalCCId }},
          set: {
            transferred: null,
            transferId: null,
            sameLo: null,
            loToLo: null,
            branchToBranch: null,
            ...originalCC
          }
        }));

        await graph.mutation(deleteQl(loansType, { _id: { _eq: newLoan._id}}));
        await graph.mutation(deleteQl(ccType, { _id: { _eq: newCC._id }}));

        // update groups
        originalGroup.availableSlots = originalGroup.availableSlots.filter(s => s !== originalLoan.slotNo);
        originalGroup.noOfClients = originalGroup.noOfClients + 1;

        if (originalGroup.noOfClients === originalGroup.capacity) {
            originalGroup.status = 'full';
        }

        if (!newGroup.availableSlots.includes(newLoan.slotNo)) {
            newGroup.availableSlots.push(newLoan.slotNo);
            newGroup.availableSlots.sort((a, b) => { return a - b; });   
        }
        newGroup.noOfClients = newGroup.noOfClients - 1;
        newGroup.status = 'available';

        const originalGroupId = originalGroup._id;
        delete originalGroup._id;
        await graph.mutation(updateQl(groupsType, {
          where: { _id: { _eq: originalGroupId } },
          set: { ...originalGroup }
        }));

        const newGroupId = newGroup._id;
        delete newGroup._id;
        await graph.mutation(updateQl(groupsType, {
          where: { _id: newGroupId },
          set: { ...newGroup }
        }));

        await graph.mutation(updateQl(clientType, {
          where: { _id: { _eq: transferData.selectedClientId } },
          set: {
            branchId: originalGroup.branchId, loId: originalGroup.loanOfficerId, groupId: originalGroupId + '', groupName: originalGroup.name
          }
        }));

        await graph.mutation(deleteQl(transferClientsType, { _id: transferData._id }));
        response = { success: true, message: "Selected transfer were properly reverted!" };
    } else {
        response = { error: true, message: "No transfer transaction found." };
    }

    res.send(response);
}