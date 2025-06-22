import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    put: updateFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');

async function updateFundTransfer(req, res) {
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
        const fundTransfer = req.body;

        // Required field validation
        if (!fundTransfer._id) {
            return res.status(400).send({
                success: false,
                message: "Fund transfer ID is required for updates."
            });
        }

        if (!fundTransfer.giverBranchId || !fundTransfer.receiverBranchId || 
            !fundTransfer.amount || !fundTransfer.account || !fundTransfer.description) {
            return res.status(400).send({
                success: false,
                message: "Missing required fields: giverBranchId, receiverBranchId, amount, account, and description are required."
            });
        }

        // Business logic validation
        if (fundTransfer.giverBranchId === fundTransfer.receiverBranchId) {
            return res.status(400).send({
                success: false,
                message: "Giver and receiver branches must be different."
            });
        }

        // Amount validation
        const amount = parseFloat(fundTransfer.amount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).send({
                success: false,
                message: "Transfer amount must be a valid number greater than zero."
            });
        }

        // Description validation
        if (!fundTransfer.description || fundTransfer.description.trim().length < 5) {
            return res.status(400).send({
                success: false,
                message: "Description must be at least 5 characters long."
            });
        }

        if (fundTransfer.description.trim().length > 500) {
            return res.status(400).send({
                success: false,
                message: "Description must not exceed 500 characters."
            });
        }

        // Account type validation
        const validAccounts = ['cash', 'bank', 'petty_cash', 'operating_fund', 'emergency_fund', 'insurance_fund'];
        if (!validAccounts.includes(fundTransfer.account)) {
            return res.status(400).send({
                success: false,
                message: "Invalid account type. Must be one of: " + validAccounts.join(', ')
            });
        }

        // Check if the fund transfer exists and is editable
        const [existingTransfer] = await graph.query(
            queryQl(FUND_TRANSFER_TYPE, {
                where: {
                    _id: { _eq: fundTransfer._id },
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

        // Access control validation - UPDATED: Only the creator can edit
        if (existingTransfer.insertedById !== user._id) {
            return res.status(403).send({
                success: false,
                message: "You can only edit fund transfers that you created."
            });
        }

        // Additional check: Only area_admin can edit (since only they can create)
        if (user.role.shortCode !== 'area_admin') {
            return res.status(403).send({
                success: false,
                message: "Access denied. Only area administrators can edit fund transfers."
            });
        }

        // Check if transfer is still pending
        if (existingTransfer.status !== 'pending') {
            return res.status(400).send({
                success: false,
                message: "Cannot edit approved or rejected fund transfers."
            });
        }

        // Prepare update set
        const updateSet = {
            account: fundTransfer.account,
            amount: amount,
            description: fundTransfer.description.trim(),
            giverBranchId: fundTransfer.giverBranchId,
            receiverBranchId: fundTransfer.receiverBranchId,
            modifiedById: user._id,
            modifiedDate: 'now()'
        };

        // Reset approval statuses if branches changed
        if (existingTransfer.giverBranchId !== fundTransfer.giverBranchId || 
            existingTransfer.receiverBranchId !== fundTransfer.receiverBranchId) {
            updateSet.giverApprovalStatus = 'pending';
            updateSet.receiverApprovalStatus = 'pending';
            updateSet.giverApprovalId = null;
            updateSet.receiverApprovalId = null;
            updateSet.giverRejectReason = null;
            updateSet.receiverRejectReason = null;
            updateSet.giverApproveRejectDate = null;
            updateSet.receiverApproveRejectDate = null;
        }

        // Update the fund transfer
        const [data] = await graph.mutation(
            updateQl(FUND_TRANSFER_TYPE, {
                set: updateSet,
                where: {
                    _id: { _eq: fundTransfer._id }
                }
            })
        ).then(res => res.data.results.returning);

        res.send({
            success: true,
            message: "Fund transfer updated successfully",
            data,
        });

    } catch (error) {
        console.error('Error updating fund transfer:', error);
        res.status(500).send({
            success: false,
            message: "Error updating fund transfer. Please try again."
        });
    }
}