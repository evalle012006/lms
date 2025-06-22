import { getCurrentDate } from "@/lib/date-utils";
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


async function generateTransactionCode(giverBranchCode) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const yearMonth = `${year}${month}`;
    const prefix = `FT${yearMonth}-${giverBranchCode}`;
    
    try {
        // Query existing fund transfers for current month and branch to get the highest counter
        const existingTransfers = await graph.query(
            queryQl(createGraphType('fund_transfer', `
                _id
                transactionCode
                giverBranch { code }
            `)('results'), {
                where: {
                    transactionCode: { _like: `${prefix}-%` },
                    deletedDate: { _is_null: true }
                },
                order_by: [{ transactionCode: "desc" }],
                limit: 1
            })
        ).then(res => res.data.results ?? []);

        let counter = 1;
        
        if (existingTransfers.length > 0) {
            const lastTransactionCode = existingTransfers[0].transactionCode;
            // Extract counter from the last transaction code (format: FTYYYYMM-BCODE-###)
            const lastCounterMatch = lastTransactionCode.match(/-(\d+)$/);
            if (lastCounterMatch) {
                counter = parseInt(lastCounterMatch[1]) + 1;
            }
        }
        
        // Format counter with leading zeros (3 digits)
        const formattedCounter = String(counter).padStart(3, '0');
        
        return `${prefix}-${formattedCounter}`;
    } catch (error) {
        console.error('Error generating transaction code:', error);
        // Fallback: use timestamp-based counter if query fails
        const timestamp = Date.now().toString().slice(-3);
        return `${prefix}-${timestamp}`;
    }
}

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

        // Check if transfer is still pending
        if (existingTransfer.status !== 'pending') {
            return res.status(400).send({
                success: false,
                message: "Cannot edit approved or rejected fund transfers."
            });
        }

        // Check if any approval has been given
        if (existingTransfer.giverApprovalStatus === 'approved' || 
            existingTransfer.receiverApprovalStatus === 'approved') {
            return res.status(400).send({
                success: false,
                message: "Cannot edit fund transfer. At least one branch has already approved this transfer."
            });
        }

        // Check if giver branch is changing to determine if we need a new transaction code
        const isGiverBranchChanging = existingTransfer.giverBranchId !== fundTransfer.giverBranchId;
        let newTransactionCode = existingTransfer.transactionCode; // Keep existing code by default

        if (isGiverBranchChanging) {
            // Get new giver branch details to extract branch code for transaction code generation
            const newGiverBranch = await graph.query(
                queryQl(createGraphType('branches', `
                    _id
                    code
                    name
                `)('results'), {
                    where: { _id: { _eq: fundTransfer.giverBranchId } }
                })
            ).then(res => res.data.results?.[0]);

            if (!newGiverBranch) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid giver branch ID."
                });
            }

            // Generate new transaction code with the new branch code
            newTransactionCode = await generateTransactionCode(newGiverBranch.code);
        }

        // Prepare update set
        const updateSet = {
            account: fundTransfer.account,
            amount: amount,
            description: fundTransfer.description.trim(),
            giverBranchId: fundTransfer.giverBranchId,
            receiverBranchId: fundTransfer.receiverBranchId,
            modifiedById: user._id,
            modifiedDate: getCurrentDate(),
        };

        // Update transaction code if giver branch changed
        if (isGiverBranchChanging) {
            updateSet.transactionCode = newTransactionCode;
        }

        // Reset approval statuses if any changes
        updateSet.giverApprovalStatus = 'pending';
        updateSet.receiverApprovalStatus = 'pending';
        updateSet.giverApprovalId = null;
        updateSet.receiverApprovalId = null;
        updateSet.giverRejectReason = null;
        updateSet.receiverRejectReason = null;
        updateSet.giverApproveRejectDate = null;
        updateSet.receiverApproveRejectDate = null;

        // Update the fund transfer
        const [data] = await graph.mutation(
            updateQl(FUND_TRANSFER_TYPE, {
                set: updateSet,
                where: {
                    _id: { _eq: fundTransfer._id }
                }
            })
        ).then(res => res.data.results.returning);

        // Prepare response message
        let message = "Fund transfer updated successfully";
        if (isGiverBranchChanging) {
            message += `. New transaction code: ${newTransactionCode}`;
        }

        res.send({
            success: true,
            message: message,
            data,
            transactionCode: newTransactionCode // Include the transaction code in response
        });

    } catch (error) {
        console.error('Error updating fund transfer:', error);
        res.status(500).send({
            success: false,
            message: "Error updating fund transfer. Please try again."
        });
    }
}