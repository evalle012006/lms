import { getCurrentDate } from "@/lib/date-utils";
import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    post: approveFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');

async function approveFundTransfer(req, res) {
    try {
        // Handle user authentication - use currentUserId if req.auth.sub is null
        const userId = req.auth?.sub || req.body.currentUserId;
        if (!userId) {
            return res.status(401).send({
                success: false,
                message: 'Authentication required. Please provide valid credentials or currentUserId.'
            });
        }

        const user = await findUserById(userId);
        const { _id, status, rejectReason } = req.body;

        // Status validation
        if (!['rejected', 'approved'].includes(status)) {
            return res.status(400).send({
                success: false,
                message: 'Invalid status. Must be either "approved" or "rejected".'
            });
        }

        // Role validation - Updated rules:
        // - Branch approval: role.rep = 3 or 4 (branch-specific roles)
        // - Final approval: role.shortCode = "finance"
        // - rep = 2 (area_admin) doesn't do approvals, only creates/edits/deletes
        const isBranchApprover = user.role.rep === 3 || user.role.rep === 4;
        const isFinanceApprover = user.role.shortCode === 'finance';
        
        if (!isBranchApprover && !isFinanceApprover) {
            console.log('DEBUG - Role validation failed:', {
                userRole: user.role?.shortCode,
                userRoleRep: user.role?.rep,
                allowedRoles: 'rep=3 or finance'
            });
            return res.status(403).send({
                success: false,
                message: 'Access denied. Only branch managers (rep=3/4) and finance can approve/reject fund transfers.'
            });
        }

        // Rejection reason validation
        if (status === 'rejected' && (!rejectReason || rejectReason.trim().length < 5)) {
            return res.status(400).send({
                success: false,
                message: 'Rejection reason is required and must be at least 5 characters long.'
            });
        }

        // Fetch the fund transfer
        console.log('DEBUG - Fetching fund transfer with ID:', _id);
        const [data] = await graph.query(
            queryQl(FUND_TRANSFER_TYPE, {
                where: {
                    _id: { _eq: _id ?? null },
                    status: { _eq: 'pending' },
                    deletedDate: { _is_null: true },
                }
            })
        ).then(res => res.data.results);

        if (!data) {
            console.log('DEBUG - Fund transfer not found or not pending');
            return res.status(404).send({
                success: false,
                message: 'Fund transfer not found or no longer pending.'
            });
        }

        // DEBUG: Log transfer data
        console.log('DEBUG - Transfer Data:', {
            transferId: data._id,
            giverBranchId: data.giverBranchId,
            receiverBranchId: data.receiverBranchId,
            currentStatus: data.status,
            giverApprovalStatus: data.giverApprovalStatus,
            receiverApprovalStatus: data.receiverApprovalStatus
        });

        let updateSet = {
            modifiedById: user._id,
            modifiedDate: getCurrentDate(),
        };

        // Branch Manager (role.rep = 3 or 4) - Can approve transfers involving their designated branch
        if (isBranchApprover) {
            // Handle designatedBranchId - only for rep=3 and rep=4, ignore for rep=2
            let userBranchId = user.designatedBranchId;
            if (!userBranchId && user.designatedBranch) {
                try {
                    // Parse the designatedBranch array string
                    const branchArray = JSON.parse(user.designatedBranch);
                    userBranchId = branchArray[0]; // Take the first branch
                } catch (e) {
                    console.warn('Could not parse designatedBranch:', user.designatedBranch);
                }
            }

            const isGiverBranch = data.giverBranchId === userBranchId;
            const isReceiverBranch = data.receiverBranchId === userBranchId;
            
            // DEBUG: Log branch matching
            console.log('DEBUG - Branch Matching:', {
                userDesignatedBranch: userBranchId,
                transferGiverBranch: data.giverBranchId,
                transferReceiverBranch: data.receiverBranchId,
                isGiverBranch,
                isReceiverBranch
            });
            
            if (!isGiverBranch && !isReceiverBranch) {
                console.log('DEBUG - Branch validation failed for branch manager');
                return res.status(403).send({
                    success: false,
                    message: 'You can only approve/reject transfers involving your designated branch.'
                });
            }

            if (status === 'rejected') {
                // Branch manager rejection - any involved branch can reject, rejecting entire transfer
                updateSet.status = 'rejected';
                updateSet.approvedRejectedDate = 'now()';
                
                if (isGiverBranch) {
                    updateSet.giverApprovalStatus = 'rejected';
                    updateSet.giverRejectReason = rejectReason.trim();
                    updateSet.giverApproveRejectDate = 'now()';
                    // Mark receiver as rejected too since transfer is rejected
                    updateSet.receiverApprovalStatus = 'rejected';
                    updateSet.receiverRejectReason = `Transfer rejected by giver branch: ${rejectReason.trim()}`;
                } else if (isReceiverBranch) {
                    updateSet.receiverApprovalStatus = 'rejected';
                    updateSet.receiverRejectReason = rejectReason.trim();
                    updateSet.receiverApproveRejectDate = 'now()';
                    // Mark giver as rejected too since transfer is rejected
                    updateSet.giverApprovalStatus = 'rejected';
                    updateSet.giverRejectReason = `Transfer rejected by receiver branch: ${rejectReason.trim()}`;
                }
                console.log('DEBUG - Branch rejection set');
            } else {
                // Branch manager approval - both branches can approve independently
                if (isGiverBranch && data.giverApprovalStatus === 'pending') {
                    updateSet.giverApprovalStatus = 'approved';
                    updateSet.giverApprovalId = user._id;
                    updateSet.giverApproveRejectDate = 'now()';
                    console.log('DEBUG - Giver branch approval set');
                } else if (isReceiverBranch && data.receiverApprovalStatus === 'pending') {
                    updateSet.receiverApprovalStatus = 'approved';
                    updateSet.receiverApprovalId = user._id;
                    updateSet.receiverApproveRejectDate = 'now()';
                    console.log('DEBUG - Receiver branch approval set');
                } else {
                    console.log('DEBUG - Branch approval step not available or already completed');
                    return res.status(400).send({
                        success: false,
                        message: 'This approval step is not available or has already been completed.'
                    });
                }
                
                // Branch managers cannot change the main status - only finance can do final approval
            }
        }

        // Finance role - Final approval only after both branches approve
        if (isFinanceApprover) {
            if (status === 'approved') {
                // Check if both giver and receiver have approved
                if (data.giverApprovalStatus !== 'approved' || data.receiverApprovalStatus !== 'approved') {
                    console.log('DEBUG - Finance cannot approve - branches have not approved yet');
                    return res.status(400).send({
                        success: false,
                        message: 'Fund transfer must be approved by both giver and receiver branches before finance can provide final approval.'
                    });
                }
                
                // Finance final approval
                updateSet.status = 'approved';
                updateSet.approvedRejectedDate = 'now()';
                console.log('DEBUG - Finance final approval set');
            } else {
                // Finance can reject at any time
                updateSet.status = 'rejected';
                updateSet.approvedRejectedDate = 'now()';
                
                // Mark both branches as rejected with finance rejection reason
                updateSet.giverApprovalStatus = 'rejected';
                updateSet.receiverApprovalStatus = 'rejected';
                updateSet.giverRejectReason = `Rejected by finance: ${rejectReason.trim()}`;
                updateSet.receiverRejectReason = `Rejected by finance: ${rejectReason.trim()}`;
                updateSet.giverApproveRejectDate = 'now()';
                updateSet.receiverApproveRejectDate = 'now()';
                console.log('DEBUG - Finance rejection set');
            }
        }

        // DEBUG: Log update set
        console.log('DEBUG - Update Set:', updateSet);

        // Update the fund transfer
        const [result] = await graph.mutation(
            updateQl(FUND_TRANSFER_TYPE, {
                set: updateSet,
                where: {
                    _id: { _eq: data._id }
                }
            })
        ).then(res => res.data.results.returning);

        const actionText = status === 'approved' ? 'approved' : 'rejected';
        
        console.log('DEBUG - Successfully updated transfer');
        res.send({
            success: true,
            message: `Fund transfer ${actionText} successfully.`,
            data: result,
        });

    } catch (error) {
        console.error('Error processing fund transfer approval:', error);
        res.status(500).send({
            success: false,
            message: "Error processing fund transfer approval. Please try again."
        });
    }
}