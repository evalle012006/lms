import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';

export default apiHandler({
    post: repair
});

async function repair(req, res) {
    const { db } = await connectToDatabase();
    const { _id } = req.body;
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const transferClients = await db.collection("transferClients")
                        .find({ _id: new ObjectId(_id) })
                        .toArray();

    logger.debug({page: `Repairing Transfer: ${_id}`, dataLength: transferClients.length});
    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(transferClients.map(async (transfer) => {
            let transferData = {...transfer};
            delete transferData._id;
            const transferIdStr = transfer._id.toString();

            const loans = await db.collection("loans")
                .find({ transferId: transferIdStr })
                .toArray();
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

                    const transferredCC = await db.collection("cashCollections")
                        .find({ groupId: sourceGroupId, slotNo: sourceSlotNo, dateAdded: transfer.approveRejectDate })
                        .toArray();
                    
                    const transferCC = await db.collection("cashCollections")
                        .find({ groupId: targetGroupId, slotNo: targetSlotNo, dateAdded: transfer.approveRejectDate })
                        .toArray();
                    
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
                        await db.collection('cashCollections').updateOne({ _id: transferredId }, { $unset: { transfer: 1, transferDate: 1 }, $set: { ...transferred } });
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

                            await db.collection('cashCollections').updateOne({ _id: transferredId }, { $unset: { transfer: 1, transferDate: 1 }, $set: { ...transferred } });
                        }

                        if (invalidData) {
                            logger.debug({page: `Repairing Transfer:`, _id: invalidData._id, message: "Deleting invalid cash collections"});
                            await db.collection('cashCollections').deleteOne({ _id: invalidData._id });
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
                        await db.collection('cashCollections').updateOne({ _id: transferId }, { $unset: { transferred: 1, transferredDate: 1 }, $set: { ...transfer } });
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

                        await db.collection('cashCollections').insertOne({ ...newTransfer });
                    }

                    transferData.repaired = true;
                    logger.debug({page: `Repairing Transfer:`, clientId: clientId, message: "Updating client data."});
                    await db.collection('client').updateOne({ _id: new ObjectId(clientId) }, { $set: { branchId: targetBranchId, loanOfficerId: targetLoId, groupId: targetGroupId } });
                }
            
                await db.collection('transferClients').updateMany({ _id: transfer._id }, { $set: { ...transferData } });
            }
        }));

        resolve(response);
    });

    if (promise) {
        response = { success: true };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}