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

export default apiHandler({
    post: deleteTransaction,
});

async function deleteTransaction(req, res) {
    const userId = req?.auth?.sub;
    const { id, branch_id } = req.body;

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
        const result = await graph.query(
            queryQl(TRANSACTION_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: { _eq: branch_id },
                },
                limit: 1,
            })
        );

        const transaction =
            result.data?.dcs_transactions?.[0];

        if (!transaction) {
            return res.status(404).json({
                error: true,
                message: "Transaction not found.",
            });
        }

        await graph.mutation(
            deleteQl(TRANSACTION_TYPE, {
                id: { _eq: id },
                branch_id: { _eq: branch_id },
            })
        );

        /*
         * dcs_transaction_items are automatically deleted
         * because the PostgreSQL FK uses ON DELETE CASCADE.
         */

        return res.status(200).json({
            success: true,
            message: "Transaction deleted successfully.",
        });
    } catch (error) {
        console.error("Delete DCS transaction error:", error);

        return res.status(500).json({
            error: true,
            message: error.message || "Failed to delete transaction.",
        });
    }
}