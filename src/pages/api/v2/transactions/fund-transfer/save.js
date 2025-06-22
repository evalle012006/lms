import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, queryQl, updateQl } from "@/lib/graph/graph.util";
import { generateUUID } from "@/lib/utils";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    post: saveFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');

async function saveFundTransfer(req, res) {
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

        // Access control validation - UPDATED: Only area_admin can create fund transfers
        if (user.role.shortCode !== 'area_admin') {
            return res.status(403).send({
                success: false,
                message: "Access denied. Only area administrators can create fund transfers."
            });
        }

        // Required field validation
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

        const [data] = await graph.mutation(
            insertQl(FUND_TRANSFER_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    account: fundTransfer.account,
                    amount: amount,
                    description: fundTransfer.description.trim(),
                    giverBranchId: fundTransfer.giverBranchId,
                    receiverBranchId: fundTransfer.receiverBranchId,
                    giverApprovalId: null,
                    receiverApprovalId: null,
                    status: 'pending',
                    giverApprovalStatus: 'pending',
                    receiverApprovalStatus: 'pending',
                    giverRejectReason: null,
                    receiverRejectReason: null,
                    insertedById: user._id,
                    insertedDate: 'now()',
                    deleted: false
                }]
            })
        ).then(res => res.data.results.returning);

        res.send({
            success: true,
            message: "Fund transfer created successfully",
            data,
        });

    } catch (error) {
        console.error('Error saving fund transfer:', error);
        res.status(500).send({
            success: false,
            message: "Error creating fund transfer. Please try again."
        });
    }
}