import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: testOnly
});

async function testOnly(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const dateAdded = "2024-06-28";

    const transferClients = await db.collection("transferClients")
                        // .find({ approveRejectDate: dateAdded, status: "approved", processed: { $ne: true } })
                        .find({ _id: new ObjectId("667ebfae5e0628f49220f97c") })
                        .sort({ $natural: -1 })
                        .limit(50)
                        .toArray();
    console.log('transferClients:', transferClients.length);
    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(transferClients.map(async (transfer) => {
            let transferData = {...transfer};
            delete transferData._id;
            const transferIdStr = transfer._id.toString();

            const loans = await db.collection("loans")
                .find({ transferId: transferIdStr })
                .toArray();
            
            if (loans.length > 0) {
                const transferLoan = loans.find(loan => loan.status != 'closed');
                const transferredLoan = loans.find(loan => loan.status == 'closed');

                if (transferredLoan && transferLoan) {
                    const clientId = transferredLoan.clientId;
                    const sourceGroupId = transferredLoan.groupId;
                    const sourceBranchId = transferredLoan.branchId;
                    const sourceLoId = transferredLoan.loId;
                    const sourceSlotNo = transferredLoan.slotNo;

                    const targetGroupId = transferLoan.groupId;
                    const targetBranchId = transferLoan.branchId;
                    const targetLoId = transferLoan.loId;
                    const targetSlotNo = transferLoan.slotNo;

                    const transferredLoanId = transferredLoan._id.toString();
                    const transferLoanId = transferLoan._id.toString();

                    const transferredCC = await db.collection("cashCollections")
                        .find({ groupId: sourceGroupId, slotNo: sourceSlotNo, dateAdded: dateAdded })
                        .toArray();
                    
                    const transferCC = await db.collection("cashCollections")
                        .find({ groupId: targetGroupId, slotNo: targetSlotNo, dateAdded: dateAdded })
                        .toArray();

                    if (transferredCC.length == 1) {
                        let transferred = {...transferredCC[0]};
                        const transferredId = transferred._id;
                        delete transferred._id;

                        transferred.transferId = transferIdStr;
                        transferred.transferred = true;
                        transferred.transferredDate = dateAdded;
                        transferred.sameLo = transfer.sameLo;
                        transferred.loToLo = transfer.loToLo;
                        transferred.branchToBranch = transfer.branchToBranch;

                        await db.collection('cashCollections').updateOne({ _id: transferredId }, { $unset: { transfer: 1, transferDate: 1 }, $set: { ...transferred } });
                    } else if (transferredCC.length > 1) {
                        console.log('Multiple transferredCC:', transferIdStr, transferredCC.map(cc => cc._id.toString()).join(','));
                        const validData = transferredCC.find(cc => cc.clientId != null);
                        const invalidData = transferredCC.find(cc => cc.clientId == null);
                        if (validData) {
                            let transferred = {...validData};
                            const transferredId = transferred._id;
                            delete transferred._id;

                            transferred.transferId = transferIdStr;
                            transferred.transferred = true;
                            transferred.transferredDate = dateAdded;
                            transferred.sameLo = transfer.sameLo;
                            transferred.loToLo = transfer.loToLo;
                            transferred.branchToBranch = transfer.branchToBranch;

                            await db.collection('cashCollections').updateOne({ _id: transferredId }, { $unset: { transfer: 1, transferDate: 1 }, $set: { ...transferred } });
                        }

                        if (invalidData) {
                            console.log('Deleted invalid CC: ', invalidData._id);
                            await db.collection('cashCollections').deleteOne({ _id: invalidData._id });
                        }
                    } else {
                        console.log('No transferredCC:', transferIdStr);
                        transferData.transferError = true;
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
                        transfer.transferDate = dateAdded;
                        transfer.sameLo = transfer.sameLo;
                        transfer.loToLo = transfer.loToLo;
                        transfer.branchToBranch = transfer.branchToBranch;
                        transfer.status = transferLoan?.status;
                        delete transfer.transferred;
                        delete transfer.transferredDate;

                        await db.collection('cashCollections').updateOne({ _id: transferId }, { $unset: { transferred: 1, transferredDate: 1 }, $set: { ...transfer } });
                    } else if (transferCC.length > 2) {
                        console.log('Multiple transferCC:', transferCC.map(cc => cc._id.toString()).join(','));
                    } else {
                        console.log('No transferCC:', transferIdStr);
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
                        newTransfer.transferDate = dateAdded;
                        newTransfer.sameLo = transfer.sameLo;
                        newTransfer.loToLo = transfer.loToLo;
                        newTransfer.branchToBranch = transfer.branchToBranch;
                        // newTransfer.status = transferLoan?.status;
                        newTransfer.paymentCollection = 0;

                        delete newTransfer.transferred;
                        delete newTransfer.transferredDate;

                        await db.collection('cashCollections').insertOne({ ...newTransfer });

                        transferData.transferError = true;
                    }

                    transferData.processed = true;
                    await db.collection('client').updateOne({ _id: new ObjectId(clientId) }, { $set: { branchId: targetBranchId, loanOfficerId: targetLoId, groupId: targetGroupId, transferError: true } });
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