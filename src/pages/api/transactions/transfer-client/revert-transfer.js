import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getEndDate } from '@/lib/utils';

export default apiHandler({
    post: revertTransfer,
});

let statusCode = 200;
let response = {};

async function revertTransfer(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { transferId } = req.body;

    const transfer = await db.collection('transferClients')
                    .aggregate([
                        { $match: { _id: new ObjectId(transferId) } },
                        { $addFields: { 
                            transferIdStr: { $toString: "$_id" },
                            sourceGroupIdObj: { $toObjectId: "$sourceGroupId" },
                            targetGroupIdObj: { $toObjectId: "$targetGroupId" }
                        } },
                        {
                            $lookup: {
                                from: "loans",
                                localField: "transferIdStr",
                                foreignField: "transferId",
                                as: "loans"
                            }
                        },
                        {
                            $lookup: {
                                from: "cashCollections",
                                localField: "transferIdStr",
                                foreignField: "transferId",
                                as: "cashCollections"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "sourceGroupIdObj",
                                foreignField: "_id",
                                as: "originalGroup"
                            }
                        },
                        {
                            $lookup: {
                                from: "groups",
                                localField: "targetGroupIdObj",
                                foreignField: "_id",
                                as: "newGroup"
                            }
                        },
                    ])
                    .toArray();
    
    if (transfer.length > 0) {
        const transferData = transfer[0];
        let originalLoan = transferData.loans.find(loan => loan.transferred === true);
        const newLoan = transferData.loans.find(loan => loan.transfer === true);
        let originalCC = transferData.cashCollections.find(cc => cc.transferred === true);
        const newCC = transferData.cashCollections.find(cc => cc.transfer === true);
        let originalGroup = transferData.originalGroup[0];
        let newGroup = transferData.newGroup[0];

        let prevLoan = await db.collection('loans').find({ _id: new ObjectId(originalCC?.prevLoanId) }).toArray();
        if (prevLoan.length > 0) {
            prevLoan = prevLoan[0];
            delete prevLoan.transferredReleased;
            delete prevLoan._id;
            await db.collection('loans').updateOne({ _id: new ObjectId(originalCC.prevLoanId) }, {$unset: {transferredReleased: 1}, $set: {...prevLoan}});
        }

        originalLoan.status = originalCC.status !== 'pending' ? originalCC.status !== 'completed' ? 'active' : 'completed' : 'pending';
        // if (originalLoan.status == 'active') {
        //     originalLoan.endDate = getEndDate(originalLoan.dateGranted, originalLoan.occurence === 'daily' ? 60 : 24 );
        // }
        
        originalLoan.revertedTransfer = true;

        delete originalLoan.transferred;
        delete originalLoan.transferId;

        const originalLoanId = originalLoan._id;
        delete originalLoan._id;
        await db.collection('loans').updateOne({ _id: originalLoanId }, { $unset: { transferred: 1, transferId: 1 }, $set: {...originalLoan} });

        delete originalCC.transferred;
        delete originalCC.sameLo;
        delete originalCC.transferId;
        delete originalCC.loToLo;
        delete originalCC.branchToBranch;

        const originalCCId = originalCC._id;
        delete originalCC._id;
        await db.collection('cashCollections').updateOne({ _id: originalCCId }, { $unset: { transferred: 1, transferId: 1, sameLo: 1, loToLo: 1, branchToBranch: 1 }, $set: {...originalCC} });

        await db.collection('loans').deleteOne({ _id: newLoan._id });
        await db.collection('cashCollections').deleteOne({ _id: newCC._id });

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
        await db.collection('groups').updateOne({ _id: originalGroupId }, { $set: { ...originalGroup } });

        const newGroupId = newGroup._id;
        delete newGroup._id;
        await db.collection('groups').updateOne({ _id: newGroupId }, { $set: { ...newGroup } });

        await db.collection('client').updateOne({ _id: new ObjectId(transferData.selectedClientId) }, { $set: { branchId: originalGroup.branchId, loId: originalGroup.loanOfficerId, groupId: originalGroupId + '', groupName: originalGroup.name } });
        await db.collection('transferClients').deleteOne({ _id: transferData._id });

        response = { success: true, message: "Selected transfer were properly reverted!" };
    } else {
        response = { error: true, message: "No transfer transaction found." };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}