import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    queryQl,
    deleteQl,
} from "@/lib/graph/graph.util";

const graph = new GraphProvider();

const TRANSACTION_TYPE = createGraphType(
    "dcs_transactions",
    `
        id
        branch_id
        created_by
        voucher_no
    `
)("dcs_transactions");

const USER_TYPE = createGraphType(
    "users",
    `
        _id
        areaId
        designatedBranchId
        role
        root
    `
)("users");

const BRANCH_TYPE = createGraphType(
    "branches",
    `
        _id
        areaId
    `
)("branches");

export default apiHandler({
    post: deleteTransaction,
});

async function deleteTransaction(req, res) {
    const userId = req?.auth?.sub;
    const { id, branch_id } = req.body || {};

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    if (!id || !branch_id) {
        return res.status(400).json({
            error: true,
            message: "Transaction ID and branch are required.",
        });
    }

    try {
        // ==========================================
        // STEP 1: GET AUTHENTICATED USER
        // ==========================================

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

        // ==========================================
        // STEP 2: CHECK USER ROLE
        // ==========================================

        const roleRep = Number(currentUser.role?.rep);

        const roleShortCode = String(
            currentUser.role?.shortCode || ""
        )
            .trim()
            .toLowerCase();

        const isAdmin = roleRep === 1;

        const isAreaManager =
            roleRep === 2 &&
            roleShortCode === "area_admin";

        const isBranchManager = roleRep === 3;

        if (!isAdmin && !isAreaManager && !isBranchManager) {
            return res.status(403).json({
                error: true,
                message:
                    "You do not have permission to delete transactions.",
            });
        }

        // ==========================================
        // STEP 3: VERIFY TRANSACTION EXISTS
        // ==========================================

        const transactionResult = await graph.query(
            queryQl(TRANSACTION_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: { _eq: branch_id },
                },
                limit: 1,
            })
        );

        const transaction =
            transactionResult.data?.dcs_transactions?.[0];

        if (!transaction) {
            return res.status(404).json({
                error: true,
                message: "Transaction not found.",
            });
        }

        // ==========================================
        // STEP 4: AREA MANAGER BRANCH VALIDATION
        // ==========================================

        if (isAreaManager) {
            const branchResult = await graph.query(
                queryQl(BRANCH_TYPE, {
                    where: {
                        _id: { _eq: transaction.branch_id },
                    },
                    limit: 1,
                })
            );

            const branch =
                branchResult.data?.branches?.[0];

            if (!branch) {
                return res.status(404).json({
                    error: true,
                    message: "Branch not found.",
                });
            }

            if (
                !currentUser.areaId ||
                !branch.areaId ||
                String(currentUser.areaId) !==
                    String(branch.areaId)
            ) {
                return res.status(403).json({
                    error: true,
                    message:
                        "You can only delete transactions from branches assigned to your area.",
                });
            }
        }

        // ==========================================
        // BRANCH MANAGER BRANCH VALIDATION
        // ==========================================

        if (isBranchManager) {
            const assignedBranchId = currentUser.designatedBranchId;

            if (
                !assignedBranchId ||
                String(assignedBranchId) !==
                    String(transaction.branch_id)
            ) {
                return res.status(403).json({
                    error: true,
                    message:
                        "You can only delete transactions from your assigned branch.",
                });
            }
        }

        // ==========================================
        // STEP 5: DELETE TRANSACTION
        // ==========================================

        const deleteResult = await graph.mutation(
            deleteQl(TRANSACTION_TYPE, {
                id: { _eq: id },
                branch_id: { _eq: branch_id },
            })
        );

        const deletedTransactions =
            deleteResult?.data?.dcs_transactions?.returning || [];

        if (deletedTransactions.length !== 1) {
            return res.status(409).json({
                error: true,
                message:
                    "Transaction was not deleted. It may have already been removed.",
            });
        }

        /*
        * Transaction items are deleted automatically
        * through PostgreSQL ON DELETE CASCADE.
        */

        return res.status(200).json({
            success: true,
            message: "Transaction deleted successfully.",
        });
    } catch (error) {
        console.error(
            "Delete DCS transaction error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to delete transaction.",
        });
    }
}