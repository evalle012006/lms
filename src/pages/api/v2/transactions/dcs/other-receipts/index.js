//src/pages/api/v2/transactions/dcs/other-receipts/index.js
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";

import {createGraphType, insertQl, queryQl, updateQl, deleteQl, } from "@/lib/graph/graph.util";

const graph = new GraphProvider();
const OTHER_RECEIPTS_TYPE = createGraphType(
    "dcs_other_receipts_transactions",
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
)("dcs_other_receipts_transactions");

const USER_TYPE = createGraphType(
    "users",
    `
        _id
        designatedBranchId
        role
    `
)("users");

const ALLOWED_TYPES = [
    "staff_loan_collection",
    "staff_loan_interest",
    "staff_cbu_collection",
    "staff_cashbond_collection",
    "staff_sbf_utility_collection",
    "mpl_contribution",
    "sss_contribution",
    "ap_payroll",
    "overstated_management_expenses",
    "salary_advance",
    "motorcycle_loan",
    "cash_advance",
    "special_advance",
    "bad_debt_collection",
];

export default apiHandler({
    get: getOtherReceiptsTransactions,
    post: createOtherReceiptsTransaction,
    put: updateOtherReceiptsTransaction,
    delete: deleteOtherReceiptsTransaction,
});

// =====================================================
// HELPERS
// =====================================================

const isValidDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const isValidMonth = (value) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));

async function verifyUser(userId, branchId) {
    if (!userId) {
        return {
            allowed: false,
            status: 401,
            message: "Unauthorized.",
        };
    }

    const result = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                _id: { _eq: userId },
            },
            limit: 1,
        })
    );

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    const user = result.data?.users?.[0];

    if (!user) {
        return {
            allowed: false,
            status: 403,
            message: "User account not found.",
        };
    }

    const roleRep = Number(user.role?.rep);

    const isAdmin = roleRep === 1;
    const isBranchManager = roleRep === 3;

    const isAreaManager =
        roleRep === 2 &&
        String(user.role?.shortCode || "")
            .trim()
            .toLowerCase() === "area_admin";

    if (!isAdmin && !isBranchManager && !isAreaManager) {
        return {
            allowed: false,
            status: 403,
            message:
                "You do not have permission to manage Other Receipts.",
        };
    }

    if (
        isBranchManager &&
        String(user.designatedBranchId) !== String(branchId)
    ) {
        return {
            allowed: false,
            status: 403,
            message:
                "You can only manage transactions for your assigned branch.",
        };
    }

    return {
        allowed: true,
        user,
    };
}

function validateTransaction(body) {
    const {
        branch_id,
        transaction_date,
        transaction_type,
        description,
        amount,
    } = body || {};

    if (!branch_id) {
        return "Branch is required.";
    }

    if (!isValidDate(transaction_date)) {
        return "A valid transaction date is required.";
    }

    if (!ALLOWED_TYPES.includes(transaction_type)) {
        return "Invalid Other Receipts transaction type.";
    }

    if (!String(description || "").trim()) {
        return "Description is required.";
    }

    const numericAmount = Number(amount);

    if (
        amount === "" ||
        amount === null ||
        amount === undefined ||
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {
        return "Amount must be greater than zero.";
    }

    return null;
}

// =====================================================
// GET OTHER RECEIPTS
// =====================================================

async function getOtherReceiptsTransactions(req, res) {
    const userId = req?.auth?.sub;

    const {
        branch_id,
        transaction_date,
        month,
    } = req.query;

    if (!branch_id || (!transaction_date && !month)) {
        return res.status(400).json({
            error: true,
            message:
                "Branch and transaction date or month are required.",
        });
    }

    if (transaction_date && !isValidDate(transaction_date)) {
        return res.status(400).json({
            error: true,
            message: "Invalid transaction date.",
        });
    }

    if (month && !isValidMonth(month)) {
        return res.status(400).json({
            error: true,
            message: "Invalid month format. Use YYYY-MM.",
        });
    }

    try {
        const permission = await verifyUser(
            userId,
            branch_id
        );

        if (!permission.allowed) {
            return res.status(permission.status).json({
                error: true,
                message: permission.message,
            });
        }

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
            const [year, monthNumber] = month
                .split("-")
                .map(Number);

            const startDate =
                `${year}-${String(monthNumber).padStart(2, "0")}-01`;

            const nextMonth = new Date(
                Date.UTC(year, monthNumber, 1)
            )
                .toISOString()
                .slice(0, 10);

            where.transaction_date = {
                _gte: startDate,
                _lt: nextMonth,
            };
        }

        const result = await graph.query(
            queryQl(OTHER_RECEIPTS_TYPE, {
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
                result.data?.dcs_other_receipts_transactions || [],
        });

    } catch (error) {
        console.error(
            "Get Other Receipts error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to load Other Receipts.",
        });
    }
}

// =====================================================
// CREATE OTHER RECEIPTS
// =====================================================

async function createOtherReceiptsTransaction(req, res) {
    const userId = req?.auth?.sub;

    const validationError = validateTransaction(req.body);

    if (validationError) {
        return res.status(400).json({
            error: true,
            message: validationError,
        });
    }

    const {
        branch_id,
        transaction_date,
        transaction_type,
        description,
        amount,
    } = req.body;

    try {
        const permission = await verifyUser(
            userId,
            branch_id
        );

        if (!permission.allowed) {
            return res.status(permission.status).json({
                error: true,
                message: permission.message,
            });
        }

        const result = await graph.mutation(
            insertQl(OTHER_RECEIPTS_TYPE, {
                objects: [
                    {
                        branch_id: String(branch_id),
                        transaction_date,
                        transaction_type,
                        description: String(description).trim(),
                        amount: Number(amount),
                        created_by: String(userId),
                    },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        const transaction =
            result.data
                ?.dcs_other_receipts_transactions
                ?.returning?.[0];

        if (!transaction) {
            throw new Error(
                "Other Receipts transaction was not created."
            );
        }

        return res.status(200).json({
            success: true,
            message:
                "Other Receipts Transaction saved successfully.",
            transaction,
        });

    } catch (error) {
        console.error(
            "Create Other Receipts error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to save Other Receipts.",
        });
    }
}

// =====================================================
// UPDATE OTHER RECEIPTS
// =====================================================

async function updateOtherReceiptsTransaction(req, res) {
    const userId = req?.auth?.sub;

    const { id, branch_id } = req.body || {};

    if (!id || !branch_id) {
        return res.status(400).json({
            error: true,
            message:
                "Transaction ID and branch are required.",
        });
    }

    const validationError = validateTransaction(req.body);

    if (validationError) {
        return res.status(400).json({
            error: true,
            message: validationError,
        });
    }

    try {
        const permission = await verifyUser(
            userId,
            branch_id
        );

        if (!permission.allowed) {
            return res.status(permission.status).json({
                error: true,
                message: permission.message,
            });
        }

        const existingResult = await graph.query(
            queryQl(OTHER_RECEIPTS_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: {
                        _eq: String(branch_id),
                    },
                },
                limit: 1,
            })
        );

        if (existingResult.errors?.length) {
            throw new Error(
                existingResult.errors[0].message
            );
        }

        const existing =
            existingResult.data
                ?.dcs_other_receipts_transactions?.[0];

        if (!existing) {
            return res.status(404).json({
                error: true,
                message:
                    "Other Receipts Transaction not found.",
            });
        }

        const {
            transaction_date,
            transaction_type,
            description,
            amount,
        } = req.body;

        const result = await graph.mutation(
            updateQl(OTHER_RECEIPTS_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: {
                        _eq: String(branch_id),
                    },
                },
                set: {
                    transaction_date,
                    transaction_type,
                    description: String(description).trim(),
                    amount: Number(amount),
                    updated_at: new Date().toISOString(),
                },
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        return res.status(200).json({
            success: true,
            message:
                "Other Receipts Transaction updated successfully.",
        });

    } catch (error) {
        console.error(
            "Update Other Receipts error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to update Other Receipts.",
        });
    }
}

// =====================================================
// DELETE OTHER RECEIPTS
// =====================================================

async function deleteOtherReceiptsTransaction(req, res) {
    const userId = req?.auth?.sub;

    const { id, branch_id } = req.query || {};

    if (!id || !branch_id) {
        return res.status(400).json({
            error: true,
            message:
                "Transaction ID and branch are required.",
        });
    }

    try {
        const permission = await verifyUser(
            userId,
            branch_id
        );

        if (!permission.allowed) {
            return res.status(permission.status).json({
                error: true,
                message: permission.message,
            });
        }

        const existingResult = await graph.query(
            queryQl(OTHER_RECEIPTS_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: {
                        _eq: String(branch_id),
                    },
                },
                limit: 1,
            })
        );

        if (existingResult.errors?.length) {
            throw new Error(
                existingResult.errors[0].message
            );
        }

        const existing =
            existingResult.data
                ?.dcs_other_receipts_transactions?.[0];

        if (!existing) {
            return res.status(404).json({
                error: true,
                message:
                    "Other Receipts Transaction not found.",
            });
        }

        const result = await graph.mutation(
            deleteQl(OTHER_RECEIPTS_TYPE, {
                id: { _eq: id },
                branch_id: {
                    _eq: String(branch_id),
                },
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        return res.status(200).json({
            success: true,
            message:
                "Other Receipts Transaction deleted successfully.",
        });

    } catch (error) {
        console.error(
            "Delete Other Receipts error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to delete Other Receipts.",
        });
    }
}