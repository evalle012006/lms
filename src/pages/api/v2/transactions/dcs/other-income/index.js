import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";

import {
    createGraphType,
    insertQl,
    queryQl,
    updateQl,
    deleteQl,
} from "@/lib/graph/graph.util";

const graph = new GraphProvider();

const OTHER_INCOME_TYPE = createGraphType(
    "dcs_other_income_transactions",
    `
        id
        branch_id
        transaction_date
        transaction_type
        description
        amount
        created_by
        created_at
        updated_at
    `
)("dcs_other_income_transactions");

const USER_TYPE = createGraphType(
    "users",
    `
        _id
        designatedBranchId
        role
    `
)("users");

const ALLOWED_TYPES = [
    "penalty",
    "excess_remittance",
    "passbook",
    "bank_deposit",
];

export default apiHandler({
    get: getOtherIncomeTransactions,
    post: createOtherIncomeTransaction,
    put: updateOtherIncomeTransaction,
    delete: deleteOtherIncomeTransaction,
});

// ============================================
// GET TRANSACTIONS
// ============================================

async function getOtherIncomeTransactions(req, res) {
    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    const { branch_id, transaction_date, month } = req.query;

    if (!branch_id || (!transaction_date && !month)) {
        return res.status(400).json({
            error: true,
            message: "Branch and transaction date or month are required.",
        });
    }

    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({
            error: true,
            message: "Invalid month format. Use YYYY-MM.",
        });
    }

    if (
        transaction_date &&
        !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
    ) {
        return res.status(400).json({
            error: true,
            message: "Invalid transaction date.",
        });
    }

    try {
        const userResult = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    _id: { _eq: userId },
                },
                limit: 1,
            })
        );

        const currentUser = userResult.data?.users?.[0];

        if (!currentUser) {
            return res.status(403).json({
                error: true,
                message: "User account not found.",
            });
        }

        const roleRep = Number(currentUser.role?.rep);

        const isAdmin = roleRep === 1;
        const isBranchManager = roleRep === 3;

        if (!isAdmin && !isBranchManager) {
            return res.status(403).json({
                error: true,
                message: "You do not have permission to access these transactions.",
            });
        }

        if (
            isBranchManager &&
            String(currentUser.designatedBranchId) !== String(branch_id)
        ) {
            return res.status(403).json({
                error: true,
                message: "You can only access your assigned branch.",
            });
        }

        // =========================================================
        // FILTER BY SPECIFIC DATE OR ENTIRE MONTH
        // =========================================================

        const where = {
            branch_id: {
                _eq: String(branch_id),
            },
        };

        if (transaction_date) {
            where.transaction_date = {
                _eq: transaction_date,
            };
        } else {
            const [year, monthNumber] = month.split("-").map(Number);

            const startDate =
                `${year}-${String(monthNumber).padStart(2, "0")}-01`;

            const nextMonth = new Date(
                Date.UTC(year, monthNumber, 1)
            ).toISOString().slice(0, 10);

            where.transaction_date = {
                _gte: startDate,
                _lt: nextMonth,
            };
        }

        const result = await graph.query(
            queryQl(OTHER_INCOME_TYPE, {
                where,
                order_by: [
                    { created_at: "desc" },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        return res.status(200).json({
            success: true,
            transactions:
                result.data?.dcs_other_income_transactions || [],
        });
    } catch (error) {
        console.error("Get Other Income Transactions error:", error);

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to load other income transactions.",
        });
    }
}

// ============================================
// CREATE TRANSACTION
// ============================================

async function createOtherIncomeTransaction(req, res) {
    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    const {
        branch_id,
        transaction_date,
        transaction_type,
        description,
        amount,
    } = req.body || {};

    if (!branch_id) {
        return res.status(400).json({
            error: true,
            message: "Branch is required.",
        });
    }

    if (
        !transaction_date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
    ) {
        return res.status(400).json({
            error: true,
            message: "A valid transaction date is required.",
        });
    }

    if (!ALLOWED_TYPES.includes(transaction_type)) {
        return res.status(400).json({
            error: true,
            message: "Invalid transaction type.",
        });
    }

    if (!String(description || "").trim()) {
        return res.status(400).json({
            error: true,
            message: "Description is required.",
        });
    }

    const numericAmount = Number(amount);

    if (
        amount === "" ||
        amount === null ||
        amount === undefined ||
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {
        return res.status(400).json({
            error: true,
            message: "Amount must be greater than zero.",
        });
    }

    try {
        // VERIFY CURRENT USER
        const userResult = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    _id: { _eq: userId },
                },
                limit: 1,
            })
        );

        const currentUser = userResult.data?.users?.[0];

        if (!currentUser) {
            return res.status(403).json({
                error: true,
                message: "User account not found.",
            });
        }

        const roleRep = Number(currentUser.role?.rep);

        const isAdmin = roleRep === 1;
        const isBranchManager = roleRep === 3;

        if (!isAdmin && !isBranchManager) {
            return res.status(403).json({
                error: true,
                message:
                    "Only Admin and Branch Manager can create other income transactions.",
            });
        }

        // BRANCH MANAGER RESTRICTION
        if (
            isBranchManager &&
            String(currentUser.designatedBranchId) !== String(branch_id)
        ) {
            return res.status(403).json({
                error: true,
                message:
                    "You can only create transactions for your assigned branch.",
            });
        }

        // SAVE TO HASURA
        const result = await graph.mutation(
            insertQl(OTHER_INCOME_TYPE, {
                objects: [
                    {
                        branch_id: String(branch_id),
                        transaction_date,
                        transaction_type,
                        description: String(description).trim(),
                        amount: numericAmount,
                        created_by: String(userId),
                    },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        const transaction =
            result.data?.dcs_other_income_transactions?.returning?.[0];

        if (!transaction) {
            throw new Error("Transaction was not created.");
        }

        return res.status(200).json({
            success: true,
            message: "Other income transaction saved successfully.",
            transaction,
        });
    } catch (error) {
        console.error("Create Other Income Transaction error:", error);

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to save other income transaction.",
        });
    }
}

// ============================================
// VERIFY USER PERMISSIONS
// ============================================

async function verifyOtherIncomeUser(userId, branchId) {
    const userResult = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                _id: { _eq: userId },
            },
            limit: 1,
        })
    );

    if (userResult.errors?.length) {
        throw new Error(userResult.errors[0].message);
    }

    const currentUser = userResult.data?.users?.[0];

    if (!currentUser) {
        return {
            allowed: false,
            message: "User account not found.",
        };
    }

    const roleRep = Number(currentUser.role?.rep);

    const isAdmin = roleRep === 1;
    const isBranchManager = roleRep === 3;

    if (!isAdmin && !isBranchManager) {
        return {
            allowed: false,
            message: "Only Admin and Branch Manager can manage Other Income Transactions.",
        };
    }

    if (
        isBranchManager &&
        String(currentUser.designatedBranchId) !== String(branchId)
    ) {
        return {
            allowed: false,
            message: "You can only manage transactions for your assigned branch.",
        };
    }

    return {
        allowed: true,
        currentUser,
    };
}

// ============================================
// UPDATE OTHER INCOME TRANSACTION
// ============================================

async function updateOtherIncomeTransaction(req, res) {
    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    const {
        id,
        branch_id,
        transaction_date,
        transaction_type,
        description,
        amount,
    } = req.body || {};

    if (!id || !branch_id) {
        return res.status(400).json({
            error: true,
            message: "Transaction ID and branch are required.",
        });
    }

    if (
        !transaction_date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
    ) {
        return res.status(400).json({
            error: true,
            message: "A valid transaction date is required.",
        });
    }

    if (!ALLOWED_TYPES.includes(transaction_type)) {
        return res.status(400).json({
            error: true,
            message: "Invalid transaction type.",
        });
    }

    if (!String(description || "").trim()) {
        return res.status(400).json({
            error: true,
            message: "Description is required.",
        });
    }

    const numericAmount = Number(amount);

    if (
        amount === "" ||
        amount === null ||
        amount === undefined ||
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {
        return res.status(400).json({
            error: true,
            message: "Amount must be greater than zero.",
        });
    }

    try {
        const permission = await verifyOtherIncomeUser(
            userId,
            branch_id
        );

        if (!permission.allowed) {
            return res.status(403).json({
                error: true,
                message: permission.message,
            });
        }

        // Verify transaction belongs to this branch.
        const existingResult = await graph.query(
            queryQl(OTHER_INCOME_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: { _eq: String(branch_id) },
                },
                limit: 1,
            })
        );

        if (existingResult.errors?.length) {
            throw new Error(existingResult.errors[0].message);
        }

        const existingTransaction =
            existingResult.data?.dcs_other_income_transactions?.[0];

        if (!existingTransaction) {
            return res.status(404).json({
                error: true,
                message: "Other Income Transaction not found.",
            });
        }

        const result = await graph.mutation(
            updateQl(OTHER_INCOME_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: { _eq: String(branch_id) },
                },
                set: {
                    transaction_date,
                    transaction_type,
                    description: String(description).trim(),
                    amount: numericAmount,
                    updated_at: new Date().toISOString(),
                },
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        return res.status(200).json({
            success: true,
            message: "Other Income Transaction updated successfully.",
        });

    } catch (error) {
        console.error("Update Other Income Transaction error:", error);

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to update Other Income Transaction.",
        });
    }
}

// ============================================
// DELETE OTHER INCOME TRANSACTION
// ============================================

async function deleteOtherIncomeTransaction(req, res) {
    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    const { id, branch_id } = req.query || {};

    if (!id || !branch_id) {
        return res.status(400).json({
            error: true,
            message: "Transaction ID and branch are required.",
        });
    }

    try {
        const permission = await verifyOtherIncomeUser(
            userId,
            branch_id
        );

        if (!permission.allowed) {
            return res.status(403).json({
                error: true,
                message: permission.message,
            });
        }

        // Verify the transaction belongs to this branch.
        const existingResult = await graph.query(
            queryQl(OTHER_INCOME_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: { _eq: String(branch_id) },
                },
                limit: 1,
            })
        );

        if (existingResult.errors?.length) {
            throw new Error(existingResult.errors[0].message);
        }

        const existingTransaction =
            existingResult.data?.dcs_other_income_transactions?.[0];

        if (!existingTransaction) {
            return res.status(404).json({
                error: true,
                message: "Other Income Transaction not found.",
            });
        }

        const result = await graph.mutation(
            deleteQl(OTHER_INCOME_TYPE, {
                id: { _eq: id },
                branch_id: { _eq: String(branch_id) },
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        return res.status(200).json({
            success: true,
            message: "Other Income Transaction deleted successfully.",
        });

    } catch (error) {
        console.error("Delete Other Income Transaction error:", error);

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to delete Other Income Transaction.",
        });
    }
}