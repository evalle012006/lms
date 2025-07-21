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

// Function to generate transaction code with global counter per month (without branch code)
async function generateTransactionCode() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const yearMonth = `${year}${month}`;
    const prefix = `FT${yearMonth}`;
    
    try {
        // Query ALL existing fund transfers for current month to get the highest counter globally
        const existingTransfers = await graph.query(
            queryQl(createGraphType('fund_transfer', `
                _id
                transactionCode
            `)('results'), {
                where: {
                    transactionCode: { _like: `${prefix}-%` },
                    deletedDate: { _is_null: true }
                },
                order_by: [{ transactionCode: "desc" }]
            })
        ).then(res => res.data.results ?? []);

        let maxCounter = 0;
        
        if (existingTransfers.length > 0) {
            // Extract all counters from transaction codes and find the maximum
            for (const transfer of existingTransfers) {
                const transactionCode = transfer.transactionCode;
                // Extract counter from transaction code (format: FTYYYYMM-####)
                const counterMatch = transactionCode.match(/-(\d+)$/);
                if (counterMatch) {
                    const counter = parseInt(counterMatch[1]);
                    if (counter > maxCounter) {
                        maxCounter = counter;
                    }
                }
            }
        }
        
        // Increment counter
        const newCounter = maxCounter + 1;
        
        // Format counter with leading zeros (4 digits to handle 1000+ transactions)
        const formattedCounter = String(newCounter).padStart(4, '0');
        
        return `${prefix}-${formattedCounter}`;
    } catch (error) {
        console.error('Error generating transaction code:', error);
        // Fallback: use timestamp-based counter if query fails
        const timestamp = Date.now().toString().slice(-4);
        return `${prefix}-${timestamp}`;
    }
}

async function updateFundTransfer(req, res) {
    try {
        // Handle user authentication - use currentUserId if req.auth.sub is null
        const userId = req.auth?.sub || req.body.currentUserId;
        if (!userId) {
            res.status(401).send({
                success: false,
                message: 'Authentication required. Please provide valid credentials or currentUserId.'
            });
            return;
        }

        const user = await findUserById(userId);
        const fundTransfer = req.body;

        // Required field validation
        if (!fundTransfer._id) {
            res.status(400).send({
                success: false,
                message: "Fund transfer ID is required for updates."
            });
            return;
        }

        if (!fundTransfer.giverBranchId || !fundTransfer.receiverBranchId || 
            !fundTransfer.amount || !fundTransfer.account || !fundTransfer.description) {
            res.status(400).send({
                success: false,
                message: "Missing required fields: giverBranchId, receiverBranchId, amount, account, and description are required."
            });
            return;
        }

        // Business logic validation
        if (fundTransfer.giverBranchId === fundTransfer.receiverBranchId) {
            res.status(400).send({
                success: false,
                message: "Giver and receiver branches must be different."
            });
            return;
        }

        // Amount validation
        const amount = parseFloat(fundTransfer.amount);
        if (isNaN(amount) || amount <= 0) {
            res.status(400).send({
                success: false,
                message: "Transfer amount must be a valid number greater than zero."
            });
            return;
        }

        // Description validation
        if (!fundTransfer.description || fundTransfer.description.trim().length < 5) {
            res.status(400).send({
                success: false,
                message: "Description must be at least 5 characters long."
            });
            return;
        }

        if (fundTransfer.description.trim().length > 500) {
            res.status(400).send({
                success: false,
                message: "Description must not exceed 500 characters."
            });
            return;
        }

        // Check if fund transfer exists and can be updated
        const [existingTransfer] = await graph.query(
            queryQl(FUND_TRANSFER_TYPE, {
                where: {
                    _id: { _eq: fundTransfer._id },
                    deletedDate: { _is_null: true }
                }
            })
        ).then(res => res.data.results);

        if (!existingTransfer) {
            res.status(404).send({
                success: false,
                message: "Fund transfer not found."
            });
            return;
        }

        // Check if transfer is still pending
        if (existingTransfer.status !== 'pending') {
            res.status(400).send({
                success: false,
                message: "Cannot edit approved or rejected fund transfers."
            });
            return;
        }

        // Check if any approval has been given
        if (existingTransfer.giverApprovalStatus === 'approved' || 
            existingTransfer.receiverApprovalStatus === 'approved') {
            res.status(400).send({
                success: false,
                message: "Cannot edit fund transfer. At least one branch has already approved this transfer."
            });
            return;
        }

        // Check if giver branch is changing to determine if we need a new transaction code
        const isGiverBranchChanging = existingTransfer.giverBranchId !== fundTransfer.giverBranchId;
        let newTransactionCode = existingTransfer.transactionCode; // Keep existing code by default

        if (isGiverBranchChanging) {
            // Validate new giver branch exists (still needed for business logic)
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
                res.status(400).send({
                    success: false,
                    message: "Invalid giver branch ID."
                });
                return;
            }

            // Generate new transaction code (without branch code)
            newTransactionCode = await generateTransactionCode();
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