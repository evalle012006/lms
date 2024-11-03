import { apiHandler } from "@/services/api-handler";
import {
  createGraphType,
  insertQl,
  updateQl,
} from "@/lib/graph/graph.util";
import {
  BRANCH_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
  TRANSFER_CLIENT_FIELDS,
  USER_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  findBranches,
  findTransferClients,
  findUsers,
} from "@/lib/graph.functions";
import { formatPricePhp, generateUUID } from "@/lib/utils";

const graph = new GraphProvider();
const transferClientsType = createGraphType("transferClients", TRANSFER_CLIENT_FIELDS)();

export default apiHandler({
    post: saveUpdate,
    get: getList
});

let response = {};

async function saveUpdate(req, res) {
    const clientData = req.body;

    if (clientData?._id) {
        const transferId = clientData._id;
        await graph.mutation(updateQl(transferClientsType, {
          where: { _id: { _eq: transferId } },
          set: { ...clientData, insertedDateTime: new Date() }
        }));
        response = { success: true };
    } else {
        const exist = await findTransferClients({
          selectedClientId: { _eq: clientData.selectedClientId },
          status: { _eq: "pending" }
        });

        if (exist.length === 0) {
            await graph.mutation(insertQl(transferClientsType, { objects: [{ ...clientData, _id: generateUUID(), modifiedDateTime: new Date()}]}))
            response = { success: true };
        } else {
            response = { error: true, message: "Client has an existing pending transfer." };
        }
    }

    res.send(response);
}

async function getList(req, res) {
    const { _id, branchId, previousLastMonthDate } = req.query;

    const pendingTransferClients = await getPendingTransfer(_id, branchId);
    const approvedTransferClients = await getApprovedTransfer(_id, branchId, previousLastMonthDate);

    // get error = true from approvedTransferClients and append it on the pendingData

    if (pendingTransferClients && approvedTransferClients) {
        const pendingData = processData(pendingTransferClients, 'pending');
        const approvedData = processData(approvedTransferClients, 'approved');

        const mergedData = [ ...pendingData, ...approvedData ];

        response = { success: true, data: mergedData };
    }

    res.send(response);
}

async function getPendingTransfer(_id, branchId) {
    let filter = null;

    if (_id) {
        console.log(_id);
        const users = await findUsers({ _id: { _eq: _id } }); // Removed .toArray()
        if (users.length > 0) {
            let branchIds = [];
            const user = users[0];
            
            // Simplified branch fetching logic based on user role
            const roleBasedQueries = {
                'area_admin': { areaId: { _eq: user.areaId } },
                'regional_manager': { regionId: { _eq: user.regionId } },
                'deputy_director': { divisionId: { _eq: user.divisionId } }
            };

            const roleQuery = roleBasedQueries[user.role.shortCode];
            if (roleQuery) {
                const branches = await findBranches(roleQuery, '_id');
                branchIds = branches.map(branch => branch._id.toString());
            }

            filter = {
                status: { _eq: 'pending' },
                sourceBranchId: { _in: branchIds }
            };
        }
    } else if (branchId) {
        filter = {
            status: { _eq: 'pending' },
            sourceBranchId: { _eq: branchId }
        };
    } else {
        filter = { status: { _eq: 'pending' } };
    }

    if (filter) {
        const fields = `
            ${TRANSFER_CLIENT_FIELDS}
            client {${CLIENT_FIELDS}}
            loans: selectedClientLoans(where: {status: { _in: ["active", "completed", "pending"] }}) {${LOAN_FIELDS}}
            closedLoans: selectedClientLoans(where: {status: { _eq: "closed" }}) {${LOAN_FIELDS}}
            sourceBranch {${BRANCH_FIELDS}}
            sourceGroup {${GROUP_FIELDS}}
            sourceUser {${USER_FIELDS}}
            targetBranch {${BRANCH_FIELDS}}
            targetGroup {${GROUP_FIELDS}}
            targetUser {${USER_FIELDS}}
        `;

        return findTransferClients(filter, fields)
            .then(rows => rows.map(({
                client,
                sourceBranch,
                sourceGroup,
                sourceUser,
                targetBranch,
                targetGroup,
                targetUser,
                ...info
            }) => ({
                ...info,
                client: [client],
                sourceGroup: [sourceGroup],
                targetGroup: [targetGroup],
                sourceBranch: [sourceBranch],
                targetBranch: [targetBranch],
                sourceUser: [sourceUser],
                targetUser: [targetUser],
            })));
    }
    
    return [];
}

async function getApprovedTransfer(_id, branchId, previousLastMonthDate) {
    let filter = null;
    
    if (_id) {
        const users = await findUsers({ _id: { _eq: _id } }); // Removed .toArray()
        if (users.length > 0) {
            let branchIds = [];
            const user = users[0];

            // Simplified branch fetching logic based on user role
            if (user.role.shortCode) {
                let branchQuery = null;
                
                switch (user.role.shortCode) {
                    case 'area_admin':
                        branchQuery = user.areaId ? { areaId: { _eq: user.areaId } } : null;
                        break;
                    case 'regional_manager':
                        branchQuery = user.regionId ? { regionId: { _eq: user.regionId } } : null;
                        break;
                    case 'deputy_director':
                        branchQuery = user.divisionId ? { divisionId: { _eq: user.divisionId } } : null;
                        break;
                }

                if (branchQuery) {
                    const branches = await findBranches(branchQuery); // Removed .toArray()
                    branchIds = branches.map(branch => branch._id.toString());
                }
            }

            filter = {
                status: { _eq: 'approved' },
                sourceBranchId: { _in: branchIds },
                approveRejectDate: { _eq: previousLastMonthDate }
            };
        }
    } else if (branchId) {
        filter = {
            status: { _eq: 'approved' },
            sourceBranchId: { _eq: branchId },
            approveRejectDate: { _eq: previousLastMonthDate }
        };
    } else {
        filter = {
            status: { _eq: 'approved' },
            approveRejectDate: { _eq: previousLastMonthDate }
        };
    }

    if (filter) {
        const fields = `
            ${TRANSFER_CLIENT_FIELDS}
            client {${CLIENT_FIELDS}}
            loans (where: {transfer: { _eq: true }, status: { _neq: "closed" }}) {${LOAN_FIELDS}}
            sourceBranch {${BRANCH_FIELDS}}
            sourceGroup {${GROUP_FIELDS}}
            sourceUser {${USER_FIELDS}}
            targetBranch {${BRANCH_FIELDS}}
            targetGroup {${GROUP_FIELDS}}
            targetUser {${USER_FIELDS}}
        `;
        
        return findTransferClients(filter, fields)
            .then(rows => rows.map(({
                client,
                sourceBranch,
                sourceGroup,
                sourceUser,
                targetBranch,
                targetGroup,
                targetUser,
                ...info
            }) => ({
                ...info,
                client: [client],
                sourceGroup: [sourceGroup],
                targetGroup: [targetGroup],
                sourceBranch: [sourceBranch],
                targetBranch: [targetBranch],
                sourceUser: [sourceUser],
                targetUser: [targetUser],
            })));
    }
    
    return [];
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
            temp.clientStatus = client.status;
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
        temp.targetBranchName = transfer.targetBranch.length > 0 ? transfer.targetBranch[0].name : '';
        temp.targetUserName = transfer.targetUser.length > 0 ? `${transfer.targetUser[0].firstName} ${transfer.targetUser[0].lastName}` : '',
        temp.targetGroupName = transfer.targetGroup.length > 0 ? transfer.targetGroup[0].name : '';

        if (status == 'pending') {
            temp.sourceGroup = transfer.sourceGroup.length > 0 ? transfer.sourceGroup[0] : null;
            temp.targetGroup = transfer.targetGroup.length > 0 ? transfer.targetGroup[0] : null;
        }

        if (temp.loanStatus === "closed") {
            temp.delinquent = true;
        }

        if (temp.withError) {
            temp.transferStatus = 'error';
        } else {
            temp.transferStatus = temp.status;
        }

        if (temp.status == 'approved') {
            temp.disable = true;
        }

        temp.origin = status;

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
                if (loan.branchId != transfer.targetBranchId) {
                    withError = true;
                    errorMsg = "Target branch does not match with the loan branch.";
                } else if (loan.loId != transfer.targetUserId) {
                    withError = true;
                    errorMsg = "Target LO does not match with the loan LO.";
                } else if (loan.groupId != transfer.targetGroupId) {
                    withError = true;
                    errorMsg = "Target group does not match with the loan group.";
                } else if (loan.slotNo != transfer.selectedSlotNo) {
                    withError = true;
                    errorMsg = "Selected slot number does not match with the loan slot number.";
                } else if (transfer.client.length == 0) {
                    withError = true;
                    errorMsg = "Selected client data was not properly updated.";
                } else {
                    withError = false;
                }
            }
        }
    } else if (closedLoans.length > 0) {
        withError = true;
        errorMsg = `Slot No ${closedLoans[0].slotNo} from group ${closedLoans[0].groupName} has no active loan.`;
    }

    return { loan: loan, error: withError, errorMsg: errorMsg };
}