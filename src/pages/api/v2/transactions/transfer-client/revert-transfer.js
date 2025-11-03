import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  CASH_COLLECTIONS_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
  TRANSFER_CLIENT_FIELDS,
} from "@/lib/graph.fields";
import { filterGraphFields, findLoans, findTransferClients } from "@/lib/graph.functions";
import { createGraphType, deleteQl, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const loansType = (alias) => createGraphType('loans', '_id') (alias);
const ccType = (alias) => createGraphType('cashCollections', '_id')(alias);
const transferClientsType = (alias) => createGraphType('transferClients', '_id')(alias);
const clientType = (alias) => createGraphType('client', '_id')(alias);
const groupsType = (alias) => createGraphType('groups', '_id')(alias);

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

    const mutationList = [];
    const addToMutationList = (handler) => {
      mutationList.push(handler('update_' + mutationList.length));
    }
    
    if (transfer.length > 0) {
        const transferData = transfer[0];
        let originalLoan = transferData.loans.find(loan => loan.transferred === true);
        const newLoan = transferData.loans.find(loan => loan.transfer === true);
        let originalCC = transferData.cashCollections.find(cc => cc.transferred === true);
        const newCC = transferData.cashCollections.find(cc => cc.transfer === true);
        let originalGroup = transferData.originalGroup;
        let newGroup = transferData.newGroup;

        let prevLoan =  await findLoans({ _id: { _eq: originalCC?.prevLoanId ?? 'null' } });
        if (prevLoan.length > 0) {
            prevLoan = prevLoan[0];
            delete prevLoan.transferredReleased;
            delete prevLoan._id;

            addToMutationList((alias) => updateQl(loansType(alias), {
              where: { _id: { _eq: originalCC.prevLoanId }},
              set: filterGraphFields(LOAN_FIELDS, {
                transferredReleased: null,
                ...prevLoan,
              })
            }))
        }

        originalLoan.status = originalCC.status !== 'pending' ? originalCC.status !== 'completed' ? 'active' : 'completed' : 'pending';
        originalLoan.revertedTransfer = true;

        delete originalLoan.transferred;
        delete originalLoan.transferId;

        const originalLoanId = originalLoan._id;
        delete originalLoan._id;
        addToMutationList((alias) => updateQl(loansType(alias), {
          where: { _id: { _eq: originalLoanId } },
          set: filterGraphFields(LOAN_FIELDS, {
            transferred: false,
            transferId: null,
            ...originalLoan,
          })
        }));
        

        delete originalCC.transferred;
        delete originalCC.sameLo;
        delete originalCC.transferId;
        delete originalCC.loToLo;
        delete originalCC.branchToBranch;

        const originalCCId = originalCC._id;
        delete originalCC._id;

        addToMutationList((alias) => updateQl(ccType(alias), {
          where: { _id: { _eq: originalCCId }},
          set: filterGraphFields(CASH_COLLECTIONS_FIELDS, {
            transferred: false,
            transferId: null,
            sameLo: false,
            loToLo: false,
            branchToBranch: false,
            ...originalCC
          })
        }));

        addToMutationList((alias) => deleteQl(loansType(alias), { _id: { _eq: newLoan._id}}));
        addToMutationList((alias) => deleteQl(ccType(alias), { _id: { _eq: newCC._id }}));

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
        console.log('originalGroupId', originalGroupId);
        addToMutationList((alias) => updateQl(groupsType(alias), {
          where: { _id: { _eq: originalGroupId } },
          set: { ...originalGroup }
        }));
        

        const newGroupId = newGroup._id;
        delete newGroup._id;
        console.log('newGroupId', newGroupId);
        addToMutationList((alias) => updateQl(groupsType(alias), {
          where: { _id: { _eq: newGroupId } },
          set: { ...newGroup }
        }));
        
        addToMutationList((alias) => updateQl(clientType(alias), {
          where: { _id: { _eq: transferData.selectedClientId } },
          set: {
            branchId: originalGroup.branchId, loId: originalGroup.loanOfficerId, groupId: originalGroupId + '', groupName: originalGroup.name
          }
        }));
        
        addToMutationList((alias) => deleteQl(transferClientsType(alias), { _id: { _eq: transferData._id } }));

        await graph.mutation(
          ... mutationList
        );

        response = { success: true, message: "Selected transfer were properly reverted!" };
    } else {
        response = { error: true, message: "No transfer transaction found." };
    }

    res.send(response);
}