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

// Function to generate transaction code with branch code
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

        // Get giver branch details to extract branch code for transaction code generation
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

        // Generate unique transaction code with branch code
        const transactionCode = await generateTransactionCode(giverBranch.code);

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
                    insertedDate: 'now()',
                    deleted: false
                }]
            })
        ).then(res => res.data.results.returning);

        res.send({
            success: true,
            message: "Fund transfer created successfully",
            data,
            transactionCode: transactionCode
        });

    } catch (error) {
        console.error('Error saving fund transfer:', error);
        res.status(500).send({
            success: false,
            message: "Error creating fund transfer. Please try again."
        });
    }
}