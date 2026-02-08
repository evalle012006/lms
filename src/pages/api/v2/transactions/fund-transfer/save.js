import { getCurrentDate } from "@/lib/date-utils";
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

        // Access control validation - UPDATED: finance and regional_manager can create fund transfers
        if (user.role.shortCode !== 'finance' && user.role.shortCode !== 'regional_manager' && user.role.shortCode !== 'deputy_director') {
            return res.status(403).send({
                success: false,
                message: "Access denied. Only finance and regional managers can create fund transfers."
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

        // Validate that giver branch exists (still needed for business logic)
        const giverBranch = await graph.query(
            queryQl(createGraphType('branches', `
                _id
                code
                name
            `)('results'), {
                where: { _id: { _eq: fundTransfer.giverBranchId } }
            })
        ).then(res => res.data.results?.[0]);

        if (!giverBranch) {
            return res.status(400).send({
                success: false,
                message: "Invalid giver branch ID."
            });
        }

        // Generate unique transaction code (without branch code)
        const transactionCode = await generateTransactionCode();

        const [data] = await graph.mutation(
            insertQl(FUND_TRANSFER_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    transactionCode: transactionCode,
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
                    insertedDate: getCurrentDate(),
                    deleted: false
                }]
            })
        ).then(res => res.data.results.returning);

        return res.send({
            success: true,
            message: "Fund transfer created successfully",
            data,
            transactionCode: transactionCode
        });

    } catch (error) {
        console.error('Error saving fund transfer:', error);
        return res.status(500).send({
            success: false,
            message: "Error creating fund transfer. Please try again."
        });
    }
}