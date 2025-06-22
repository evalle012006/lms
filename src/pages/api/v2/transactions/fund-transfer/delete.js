import { getCurrentDate } from "@/lib/date-utils";
import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    post: deleteFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');

async function deleteFundTransfer(req, res) {
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
        const { _id } = req.body;

        // Required field validation
        if (!_id) {
            return res.status(400).send({
                success: false,
                message: "Fund transfer ID is required."
            });
        }

        // Check if the fund transfer exists
        const [existingTransfer] = await graph.query(
            queryQl(FUND_TRANSFER_TYPE, {
                where: {
                    _id: { _eq: _id },
                    deletedDate: { _is_null: true }
                }
            })
        ).then(res => res.data.results);

        if (!existingTransfer) {
            return res.status(404).send({
                success: false,
                message: "Fund transfer not found."
            });
        }

        // Access control validation - UPDATED RULES:
        // Rule 1: Only the creator (area_admin with rep=2) OR giver branch (rep=3/4) can delete
        const isCreator = existingTransfer.insertedById === user._id;
        const isAreaAdmin = user.role?.shortCode === 'area_admin';
        const isBranchManager = user.role?.rep === 3 || user.role?.rep === 4;
        
        // Handle designatedBranchId - only for rep=3 and rep=4, ignore for rep=2
        let userBranchId = null;
        let isGiverBranch = false;
        
        if (user.role?.rep === 3 || user.role?.rep === 4) {
            userBranchId = user.designatedBranchId;
            if (!userBranchId && user.designatedBranch) {
                try {
                    // Parse the designatedBranch array string
                    const branchArray = JSON.parse(user.designatedBranch);
                    userBranchId = branchArray[0]; // Take the first branch
                } catch (e) {
                    console.warn('Could not parse designatedBranch:', user.designatedBranch);
                }
            }
            isGiverBranch = userBranchId === existingTransfer.giverBranchId;
        }
        
        if (!((isCreator && isAreaAdmin) || (isBranchManager && isGiverBranch))) {
            return res.status(403).send({
                success: false,
                message: "You can only delete fund transfers that you created (area_admin) or transfers from your designated branch as giver branch (rep=3/4)."
            });
        }

        // Rule 2: Check if transfer is still deletable (no approvals yet)
        if (existingTransfer.status !== 'pending') {
            return res.status(400).send({
                success: false,
                message: "Cannot delete approved or rejected fund transfers."
            });
        }

        // Rule 3: Check if any approval status is already approved
        if (existingTransfer.giverApprovalStatus === 'approved' || 
            existingTransfer.receiverApprovalStatus === 'approved') {
            return res.status(400).send({
                success: false,
                message: "Cannot delete fund transfer. At least one branch has already approved this transfer."
            });
        }

        // Additional check: If any approval status is rejected, also prevent deletion
        if (existingTransfer.giverApprovalStatus === 'rejected' || 
            existingTransfer.receiverApprovalStatus === 'rejected') {
            return res.status(400).send({
                success: false,
                message: "Cannot delete rejected fund transfers."
            });
        }

        // Perform soft delete
        const [data] = await graph.mutation(
            updateQl(FUND_TRANSFER_TYPE, {
                set: {
                    deleted: true,
                    deletedDate: getCurrentDate(),
                    deletedById: user._id,
                    modifiedById: user._id,
                    modifiedDate: getCurrentDate(),
                },
                where: {
                    _id: { _eq: _id }
                }
            })
        ).then(res => res.data.results.returning);

        res.send({
            success: true,
            message: "Fund transfer deleted successfully",
            data,
        });

    } catch (error) {
        console.error('Error deleting fund transfer:', error);
        res.status(500).send({
            success: false,
            message: "Error deleting fund transfer. Please try again."
        });
    }
}