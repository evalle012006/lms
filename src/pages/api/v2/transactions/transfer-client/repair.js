import { apiHandler } from "@/services/api-handler";
import logger from "@/logger";
import {
  findCashCollections,
  findLoans,
  findTransferClients,
} from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  createGraphType,
  deleteQl,
  insertQl,
  updateQl,
} from "@/lib/graph/graph.util";

const graph = new GraphProvider();
const cashCollectionsType = createGraphType('cashCollections', '_id')();
const clientType = createGraphType('client', '_id')();
const transferClientsType = createGraphType('transferClients', '_id')();

export default apiHandler({
    post: repair
});

async function repair(req, res) {
    const { _id } = req.body;
    let response;

    const transferClients = await findTransferClients({ _id: { _eq: _id }});

    logger.debug({page: `Repairing Transfer: ${_id}`, dataLength: transferClients.length});
    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(transferClients.map(async (transfer) => {
            let transferData = {...transfer};
            delete transferData._id;
            const transferIdStr = transfer._id.toString();

            const loans = await findLoans({ transferId: { _eq: transferIdStr }});

            logger.debug({page: `Repairing Transfer - Loans:`, dataLength: loans.length});
            if (loans.length > 0) {
                const transferLoan = loans.find(loan => loan.status != 'closed');
                const transferredLoan = loans.find(loan => loan.status == 'closed');

                if (transferredLoan && transferLoan) {
                    const clientId = transferredLoan.clientId;
                    const sourceGroupId = transferredLoan.groupId;
                    const sourceSlotNo = transferredLoan.slotNo;

                    const targetGroupId = transferLoan.groupId;
                    const targetBranchId = transferLoan.branchId;
                    const targetLoId = transferLoan.loId;
                    const targetSlotNo = transferLoan.slotNo;

                    const transferredLoanId = transferredLoan._id.toString();
                    const transferLoanId = transferLoan._id.toString();

                    const transferredCC = await findCashCollections({
                      groupId: { _eq: sourceGroupId },
                      slotNo: { _eq: sourceSlotNo },
                      dateAdded: { _eq: transfer.approveRejectDate }
                    });
                    
                    const transferCC = await findCashCollections({
                      groupId: { _eq: targetGroupId },
                      slotNo: { _eq: targetSlotNo },
                      dateAdded: { _eq: transfer.approveRejectDate }
                    });
                    
                    if (transferredCC.length == 1) {
                        let transferred = {...transferredCC[0]};
                        const transferredId = transferred._id;
                        delete transferred._id;

                        transferred.transferId = transferIdStr;
                        transferred.transferred = true;
                        transferred.transferredDate = transfer.approveRejectDate;
                        transferred.sameLo = transfer.sameLo;
                        transferred.loToLo = transfer.loToLo;
                        transferred.branchToBranch = transfer.branchToBranch;
                        logger.debug({page: `Repairing Transfer:`, _id: transferredId, message: "Updating Transferred CashCollections"});
                        await graph.mutation(updateQl(cashCollectionsType, {
                          where: { _id: { _eq: transferredId } },
                          set: { 
                            ...transferred,
                            transfer: null,
                            transferDate: null,
                          }
                        }));
                    } else if (transferredCC.length > 1) {
                        logger.debug({page: `Repairing Transfer`, transferId: transferIdStr, message: "Multiple transferredCC", data: transferredCC.map(cc => cc._id.toString()).join(',')});
                        const validData = transferredCC.find(cc => cc.clientId != null);
                        const invalidData = transferredCC.find(cc => cc.clientId == null);
                        if (validData) {
                            let transferred = {...validData};
                            const transferredId = transferred._id;
                            delete transferred._id;

                            transferred.transferId = transferIdStr;
                            transferred.transferred = true;
                            transferred.transferredDate = transfer.approveRejectDate;
                            transferred.sameLo = transfer.sameLo;
                            transferred.loToLo = transfer.loToLo;
                            transferred.branchToBranch = transfer.branchToBranch;

                            await graph.mutation(updateQl(cashCollectionsType, {
                              where: { _id: { _eq: transferredId } },
                              set: {
                                ...transferred,
                                transfer: null,
                                transferDate: null,
                              }
                            }));
                        }

                        if (invalidData) {
                            logger.debug({page: `Repairing Transfer:`, _id: invalidData._id, message: "Deleting invalid cash collections"});
                            await graph.mutation(deleteQl(cashCollectionsType, { _id: { _eq: invalidData._id } }));
                        }
                    } else {
                        console.log('No transferredCC:', transferIdStr);
                        logger.debug({page: `Repairing Transfer:`, transferId: transferIdStr, message: "No transferred cash collections"});
                    }

                    if (transferCC.length == 1) {
                        let transfer = {...transferCC[0]};
                        const transferId = transfer._id;
                        delete transfer._id;

                        transfer.oldLoanId = transferredLoanId;
                        transfer.loanId = transferLoanId;
                        transfer.clientId = clientId;
                        transfer.transferId = transferIdStr;
                        transfer.transfer = true;
                        transfer.transferDate = transfer.approveRejectDate;
                        transfer.sameLo = transfer.sameLo;
                        transfer.loToLo = transfer.loToLo;
                        transfer.branchToBranch = transfer.branchToBranch;
                        transfer.status = transferLoan?.status;
                        delete transfer.transferred;
                        delete transfer.transferredDate;
                        logger.debug({page: `Repairing Transfer:`, _id: transferId, message: "Updating Transfer CashCollections"});
                        await graph.mutation(updateQl(cashCollectionsType, {
                          where: { _id: { _eq: transferId } },
                          set: {
                            ...transfer,
                            transferred: null,
                            transferredDate: null,
                          }
                        }));
                    } else if (transferCC.length > 2) {
                        logger.debug({page: `Repairing Transfer`, transferId: transferIdStr, message: "Multiple transferCC", data: transferCC.map(cc => cc._id.toString()).join(',')});
                    } else {
                        logger.debug({page: `Repairing Transfer:`, transferId: transferIdStr, message: "No transferCC"});
                        let newTransfer = {...transferredCC[0]};
                        delete newTransfer._id;

                        if (newTransfer.status == 'tomorrow') {
                            newTransfer.activeLoan = 0;
                            newTransfer.targetCollection = 0;
                            newTransfer.amountRelease = 0;
                            newTransfer.loanBalance = 0;
                        }
                        newTransfer.groupId = targetGroupId;
                        newTransfer.slotNo = targetSlotNo;
                        newTransfer.branchId = targetBranchId;
                        newTransfer.loId = targetLoId;
                        newTransfer.oldLoanId = transferredLoanId;
                        newTransfer.loanId = transferLoanId;
                        newTransfer.clientId = clientId;
                        newTransfer.transferId = transferIdStr;
                        newTransfer.transfer = true;
                        newTransfer.transferDate = transfer.approveRejectDate;
                        newTransfer.sameLo = transfer.sameLo;
                        newTransfer.loToLo = transfer.loToLo;
                        newTransfer.branchToBranch = transfer.branchToBranch;
                        newTransfer.paymentCollection = 0;

                        delete newTransfer.transferred;
                        delete newTransfer.transferredDate;

                        await graph.mutation(insertQl(cashCollectionsType, { objects: [{...newTransfer}]}));
                    }

                    transferData.repaired = true;
                    logger.debug({page: `Repairing Transfer:`, clientId: clientId, message: "Updating client data."});
                    await graph.mutation(updateQl(clientType, {
                      where: { _id: { _eq: clientId } },
                      set: {
                        branchId: targetBranchId,
                        loanOfficerId: targetLoId,
                        groupId: targetGroupId
                      }
                    }));
                }
            
                await graph.mutation(updateQl(transferClientsType, {
                  where: { _id: { _eq: transfer._id } },
                  set: { ...transferData }
                }));
            }
        }));

        resolve(response);
    });

    if (promise) {
        response = { success: true };
    }

    res.send(response);
}