import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { formatPricePhp, getLastWeekdayOfTheMonth } from '@/lib/utils';
import { stat } from 'fs';

export default apiHandler({
    post: saveUpdate,
    get: getList
});

let statusCode = 200;
let response = {};

async function saveUpdate(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const clientData = req.body;

    if (clientData?._id) {
        const transferId = clientData._id;
        await db.collection("transferClients").updateOne({ _id: new ObjectId(transferId) }, { $set: { ...clientData, insertedDateTime: new Date() } });
        response = { success: true };
    } else {
        const exist = await db.collection("transferClients").find({ selectedClientId: clientData.selectedClientId, status: "pending" }).toArray();

        if (exist.length === 0) {
            await db.collection("transferClients").insertOne({...clientData, modifiedDateTime: new Date()});
            response = { success: true };
        } else {
            response = { error: true, message: "Client has an existing pending transfer." };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getList(req, res) {
    const { db } = await connectToDatabase();
    const { _id, branchId, previousLastMonthDate } = req.query;

    const pendingTransferClients = await getPendingTransfer(db, _id, branchId);
    const approvedTransferClients = await getApprovedTransfer(db, _id, branchId, previousLastMonthDate);

    // get error = true from approvedTransferClients and append it on the pendingData

    if (pendingTransferClients && approvedTransferClients) {
        const pendingData = processData(pendingTransferClients, 'pending');
        const approvedData = processData(approvedTransferClients, 'approved');

        response = { success: true, pending: pendingData, approved: approvedData };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getPendingTransfer(db, _id, branchId) {
    const ObjectId = require('mongodb').ObjectId;
    if (_id) {
        const user = await db.collection('users').find({ _id: new ObjectId(_id) }).toArray();
        if (user.length > 0) {
            let branchIds = [];
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            }

            return await db
                .collection('transferClients')
                .aggregate([
                    { $match: { $expr: {$and: [{$eq: ['$status', 'pending']}, {$in: ['$sourceBranchId', branchIds]}]} } },
                    {
                        $addFields: {
                            "clientIdObj": { $toObjectId: "$selectedClientId" },
                            "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                            "targetGroupIdObj": { $toObjectId: "$targetGroupId" },
                            "sourceBranchIdObj": { $toObjectId: "$sourceBranchId" },
                            "targetBranchIdObj": { $toObjectId: "$targetBranchId" },
                            "sourceUserIdObj": { $toObjectId: "$sourceUserId" },
                            "targetUserIdObj": { $toObjectId: "$targetUserId" }
                            
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: 'selectedClientId',
                            foreignField: 'clientId',
                            pipeline: [
                                { $match: { status: { $in: ['active', 'completed', 'pending'] } } }
                            ],
                            as: 'loans'
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: 'selectedClientId',
                            foreignField: 'clientId',
                            pipeline: [
                                { $match: { status: 'closed' } }
                            ],
                            as: 'closedLoans'
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: 'sourceGroupIdObj',
                            foreignField: '_id',
                            as: 'sourceGroup'
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: 'targetGroupIdObj',
                            foreignField: '_id',
                            as: 'targetGroup'
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: 'sourceBranchIdObj',
                            foreignField: '_id',
                            as: 'sourceBranch'
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: 'targetBranchIdObj',
                            foreignField: '_id',
                            as: 'targetBranch'
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: 'sourceUserIdObj',
                            foreignField: '_id',
                            as: 'sourceUser'
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: 'targetUserIdObj',
                            foreignField: '_id',
                            as: 'targetUser'
                        }
                    },
                    { $project: { clientIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0, sourceBranchIdObj: 0, targetBranchIdObj: 0, sourceUserIdObj: 0, targetUserIdObj: 0 } }
                ])
                .toArray();
        }
    } else if (branchId) {
        return await db
            .collection('transferClients')
            .aggregate([
                { $match: { $expr: {$and: [{$eq: ['$status', 'pending']}, {$eq: ['$sourceBranchId', branchId]}]} } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$selectedClientId" },
                        "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                        "targetGroupIdObj": { $toObjectId: "$targetGroupId" },
                        "sourceBranchIdObj": { $toObjectId: "$sourceBranchId" },
                        "targetBranchIdObj": { $toObjectId: "$targetBranchId" },
                        "sourceUserIdObj": { $toObjectId: "$sourceUserId" },
                        "targetUserIdObj": { $toObjectId: "$targetUserId" }
                        
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'selectedClientId',
                        foreignField: 'clientId',
                        pipeline: [
                            { $match: { status: { $in: ['active', 'completed', 'pending'] } } }
                        ],
                        as: 'loans'
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'selectedClientId',
                        foreignField: 'clientId',
                        pipeline: [
                            { $match: { status: 'closed' } }
                        ],
                        as: 'closedLoans'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'sourceGroupIdObj',
                        foreignField: '_id',
                        as: 'sourceGroup'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'targetGroupIdObj',
                        foreignField: '_id',
                        as: 'targetGroup'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'sourceBranchIdObj',
                        foreignField: '_id',
                        as: 'sourceBranch'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'targetBranchIdObj',
                        foreignField: '_id',
                        as: 'targetBranch'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'sourceUserIdObj',
                        foreignField: '_id',
                        as: 'sourceUser'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'targetUserIdObj',
                        foreignField: '_id',
                        as: 'targetUser'
                    }
                },
                { $project: { clientIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0, sourceBranchIdObj: 0, targetBranchIdObj: 0, sourceUserIdObj: 0, targetUserIdObj: 0 } }
            ])
            .toArray();
       
    } else {
        return await db
            .collection('transferClients')
            .aggregate([
                { $match: { $expr: { $eq: ['$status', 'pending'] } } },
                {
                    $addFields: {
                        "clientIdObj": { $toObjectId: "$selectedClientId" },
                        "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                        "targetGroupIdObj": { $toObjectId: "$targetGroupId" },
                        "sourceBranchIdObj": { $toObjectId: "$sourceBranchId" },
                        "targetBranchIdObj": { $toObjectId: "$targetBranchId" },
                        "sourceUserIdObj": { $toObjectId: "$sourceUserId" },
                        "targetUserIdObj": { $toObjectId: "$targetUserId" }
                        
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'selectedClientId',
                        foreignField: 'clientId',
                        pipeline: [
                            { $match: { status: { $in: ['active', 'completed', 'pending'] } } }
                        ],
                        as: 'loans'
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'selectedClientId',
                        foreignField: 'clientId',
                        pipeline: [
                            { $match: { status: 'closed' } }
                        ],
                        as: 'closedLoans'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'sourceGroupIdObj',
                        foreignField: '_id',
                        as: 'sourceGroup'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'targetGroupIdObj',
                        foreignField: '_id',
                        as: 'targetGroup'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'sourceBranchIdObj',
                        foreignField: '_id',
                        as: 'sourceBranch'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'targetBranchIdObj',
                        foreignField: '_id',
                        as: 'targetBranch'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'sourceUserIdObj',
                        foreignField: '_id',
                        as: 'sourceUser'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'targetUserIdObj',
                        foreignField: '_id',
                        as: 'targetUser'
                    }
                },
                { $project: { clientIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0, sourceBranchIdObj: 0, targetBranchIdObj: 0, sourceUserIdObj: 0, targetUserIdObj: 0 } }
            ])
            .toArray();
    }
}

async function getApprovedTransfer(db, _id, branchId, previousLastMonthDate) {
    const ObjectId = require('mongodb').ObjectId;
    if (_id) {
        const user = await db.collection('users').find({ _id: new ObjectId(_id) }).toArray();
        if (user.length > 0) {
            let branchIds = [];
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            }

            return await db
                .collection('transferClients')
                .aggregate([
                    { $match: { $expr: {$and: [{$eq: ['$status', 'approved']}, {$in: ['$sourceBranchId', branchIds]}, {$eq: ['$approveRejectDate', previousLastMonthDate]}]} } },
                    {
                        $addFields: {
                            "transferIdStr": { $toString: "$_id" },
                            "clientIdObj": { $toObjectId: "$selectedClientId" },
                            "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                            "targetGroupIdObj": { $toObjectId: "$targetGroupId" },
                            "sourceBranchIdObj": { $toObjectId: "$sourceBranchId" },
                            "targetBranchIdObj": { $toObjectId: "$targetBranchId" },
                            "sourceUserIdObj": { $toObjectId: "$sourceUserId" },
                            "targetUserIdObj": { $toObjectId: "$targetUserId" }
                            
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            as: "client"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: 'transferIdStr',
                            foreignField: 'transferId',
                            pipeline: [
                                { $match: { transfer: true, status: { $ne: 'closed' } } }
                            ],
                            as: 'loans'
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: 'sourceGroupIdObj',
                            foreignField: '_id',
                            as: 'sourceGroup'
                        }
                    },
                    {
                        $lookup: {
                            from: "groups",
                            localField: 'targetGroupIdObj',
                            foreignField: '_id',
                            as: 'targetGroup'
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: 'sourceBranchIdObj',
                            foreignField: '_id',
                            as: 'sourceBranch'
                        }
                    },
                    {
                        $lookup: {
                            from: "branches",
                            localField: 'targetBranchIdObj',
                            foreignField: '_id',
                            as: 'targetBranch'
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: 'sourceUserIdObj',
                            foreignField: '_id',
                            as: 'sourceUser'
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: 'targetUserIdObj',
                            foreignField: '_id',
                            as: 'targetUser'
                        }
                    },
                    { $project: { transferIdStr: 0, clientIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0, sourceBranchIdObj: 0, targetBranchIdObj: 0, sourceUserIdObj: 0, targetUserIdObj: 0 } }
                ])
                .toArray();
        }
    } else if (branchId) {
        return await db
            .collection('transferClients')
            .aggregate([
                { $match: { $expr: {$and: [{$eq: ['$status', 'approved']}, {$eq: ['$sourceBranchId', branchId]}, {$eq: ['$approveRejectDate', previousLastMonthDate]}]} } },
                {
                    $addFields: {
                        "transferIdStr": { $toString: "$_id" },
                        "clientIdObj": { $toObjectId: "$selectedClientId" },
                        "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                        "targetGroupIdObj": { $toObjectId: "$targetGroupId" },
                        "sourceBranchIdObj": { $toObjectId: "$sourceBranchId" },
                        "targetBranchIdObj": { $toObjectId: "$targetBranchId" },
                        "sourceUserIdObj": { $toObjectId: "$sourceUserId" },
                        "targetUserIdObj": { $toObjectId: "$targetUserId" }
                        
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'transferIdStr',
                        foreignField: 'transferId',
                        pipeline: [
                            { $match: { transfer: true, status: { $ne: 'closed' } } }
                        ],
                        as: 'loans'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'sourceGroupIdObj',
                        foreignField: '_id',
                        as: 'sourceGroup'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'targetGroupIdObj',
                        foreignField: '_id',
                        as: 'targetGroup'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'sourceBranchIdObj',
                        foreignField: '_id',
                        as: 'sourceBranch'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'targetBranchIdObj',
                        foreignField: '_id',
                        as: 'targetBranch'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'sourceUserIdObj',
                        foreignField: '_id',
                        as: 'sourceUser'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'targetUserIdObj',
                        foreignField: '_id',
                        as: 'targetUser'
                    }
                },
                { $project: { transferIdStr: 0, clientIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0, sourceBranchIdObj: 0, targetBranchIdObj: 0, sourceUserIdObj: 0, targetUserIdObj: 0 } }
            ])
            .toArray();
       
    } else {
        return await db
            .collection('transferClients')
            .aggregate([
                { $match: { $expr: {$and: [{$eq: ['$status', 'approved']}, {$eq: ['$approveRejectDate', previousLastMonthDate]}]} } },
                {
                    $addFields: {
                        "transferIdStr": { $toString: "$_id" },
                        "clientIdObj": { $toObjectId: "$selectedClientId" },
                        "sourceGroupIdObj": { $toObjectId: "$sourceGroupId" },
                        "targetGroupIdObj": { $toObjectId: "$targetGroupId" },
                        "sourceBranchIdObj": { $toObjectId: "$sourceBranchId" },
                        "targetBranchIdObj": { $toObjectId: "$targetBranchId" },
                        "sourceUserIdObj": { $toObjectId: "$sourceUserId" },
                        "targetUserIdObj": { $toObjectId: "$targetUserId" }
                        
                    }
                },
                {
                    $lookup: {
                        from: "client",
                        localField: "clientIdObj",
                        foreignField: "_id",
                        as: "client"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'transferIdStr',
                        foreignField: 'transferId',
                        pipeline: [
                            { $match: { transfer: true, status: { $ne: 'closed' } } }
                        ],
                        as: 'loans'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'sourceGroupIdObj',
                        foreignField: '_id',
                        as: 'sourceGroup'
                    }
                },
                {
                    $lookup: {
                        from: "groups",
                        localField: 'targetGroupIdObj',
                        foreignField: '_id',
                        as: 'targetGroup'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'sourceBranchIdObj',
                        foreignField: '_id',
                        as: 'sourceBranch'
                    }
                },
                {
                    $lookup: {
                        from: "branches",
                        localField: 'targetBranchIdObj',
                        foreignField: '_id',
                        as: 'targetBranch'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'sourceUserIdObj',
                        foreignField: '_id',
                        as: 'sourceUser'
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: 'targetUserIdObj',
                        foreignField: '_id',
                        as: 'targetUser'
                    }
                },
                { $project: { transferIdStr: 0, clientIdObj: 0, sourceGroupIdObj: 0, targetGroupIdObj: 0, sourceBranchIdObj: 0, targetBranchIdObj: 0, sourceUserIdObj: 0, targetUserIdObj: 0 } }
            ])
            .toArray();
    }
}

function processData(data, status) {
    const list = [];
    data.map(transfer => {
        let temp = {
            _id: transfer._id,
            sourceBranchId: transfer.sourceBranchId,
            sourceUserId: transfer.sourceUserId,
            sourceGroupId: transfer.sourceGroupId,
            targetBranchId: transfer.targetBranchId,
            targetUserId: transfer.targetUserId,
            targetGroupId: transfer.targetGroupId,
            selectedClientId: transfer.selectedClientId,
            selectedSlotNo: transfer.selectedSlotNo,
            currentSlotNo: transfer.currentSlotNo,
            occurence: transfer.occurence,
            sameLo: transfer.sameLo,
            loToLo: transfer.loToLo,
            branchToBranch: transfer.branchToBranch,
            status: transfer.status,
            dateAdded: transfer.dateAdded
        };

        if (transfer.client.length > 0) {
            const client = transfer.client[0];
            temp.fullName = client.fullName;
            temp.lastName = client.lastName;
            temp.firstName = client.firstName;
            temp.status = client.status;
            temp.clientBranchId = client.branchId;
            temp.clientLoId = client.loId;
            temp.clientGroupId = client.groupId;
        }

        const processLoan = getAndValidateLoan(transfer, status);
        const loan = processLoan.loan;
        temp.withError = processLoan.error;
        temp.errorMsg = processLoan.errorMsg;

        if (loan) {
            temp.loanId = loan._id;
            temp.amountRelease = loan.amountRelease;
            temp.amountReleaseStr = temp.amountRelease > 0 ? formatPricePhp(temp.amountRelease) : '-';
            temp.loanBalance = loan.loanBalance;
            temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : '-';
            temp.targetCollection = loan.amountRelease - loan.loanBalance;
            temp.targetCollectionStr = temp.targetCollection > 0 ? formatPricePhp(temp.targetCollection) : '-';
            temp.actualCollection = loan.amountRelease - loan.loanBalance;
            temp.actualCollectionStr = temp.actualCollection > 0 ? formatPricePhp(temp.actualCollection) : '-';
            temp.totalMcbu = loan.mcbu;
            temp.totalMcbuStr = temp.totalMcbu > 0 ? formatPricePhp(temp.totalMcbu) : '-';
            temp.loanStatus = loan.status;
        }

        temp.sourceBranchName = transfer.sourceBranch.length > 0 ? transfer.sourceBranch[0].name : '';
        temp.sourceUserName = transfer.sourceUser.length > 0 ? `${transfer.sourceUser[0].firstName} ${transfer.sourceUser[0].lastName}` : '',
        temp.sourceGroupName = transfer.sourceGroup.length > 0 ? transfer.sourceGroup[0].name : '';
        temp.targetBranchName = transfer.targetBranch.lenth > 0 ? transfer.targetBranch[0].name : '';
        temp.targetUserName = transfer.targetUser.length > 0 ? `${transfer.targetUser[0].firstName} ${transfer.targetUser[0].lastName}` : '',
        temp.targetGroupName = transfer.targetGroup.length > 0 ? transfer.targetGroup[0].name : '';

        if (status == 'pending') {
            temp.sourceGroup = transfer.sourceGroup.length > 0 ? transfer.sourceGroup[0] : null;
            temp.targetGroup = transfer.targetGroup.length > 0 ? transfer.targetGroup[0] : null;
        }

        if (temp.loanStatus === "closed") {
            temp.delinquent = true;
        }
 
        list.push(temp);
    });

    return list;
}

function getAndValidateLoan(transfer, status) {
    const loans = transfer.loans;
    const closedLoans = transfer.closedLoans ? transfer.closedLoans : [];
    let withError = false;
    let errorMsg;
    let loan;
    
    if (loans.length > 0) {
        if (loans.length > 1) {
            withError = true;
            errorMsg = `Slot No ${loans[0].slotNo} from group ${loans[0].groupName} has multiple loans open. Please contact System support.`;
        } else {
            loan = loans[0];

            if (status == 'approved') {
                // check if loan.branchId is equal to targetBranchId
                // check if loan.loId is equal to targetUserId
                // check if loan.groupId is equal to targetGroupId
                // check if loan.slotNo is equal to selectedSlotNo
                if (loan.branchId == transfer.targetBranchId && loan.loId == transfer.targetUserId && loan.groupId == transfer.targetGroupId && loan.slotNo == transfer.selectedSlotNo) {
                    withError = false;
                } else {
                    withError = true;
                    errorMsg = "Loan details does not match with the transfer details.";
                }
            }
        }
    } else if (closedLoans.length > 0) {
        withError = true;
        errorMsg = `Slot No ${closedLoans[0].slotNo} from group ${closedLoans[0].groupName} has no active loan.`;
    }

    return { loan: loan, error: withError, errorMsg: errorMsg };
}