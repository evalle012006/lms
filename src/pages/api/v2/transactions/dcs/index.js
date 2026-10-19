import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

const TRANSACTION_TYPE = createGraphType(
    "dcs_transactions",
    `
        id
        branch_id
        created_by
        paid_to
        address
        transaction_date
        voucher_no
        total_amount
        total_amount_words
        cashier_in_charge
        supervisor
        received_by
        created_at
        updated_at

        dcs_transaction_items {
            id
            transaction_id
            category
            code
            account_title
            description
            amount
            created_at
            updated_at
        }
    `
)("dcs_transactions");

export default apiHandler({
    get: getTransactions,
});

async function getTransactions(req, res) {
    const userId = req?.auth?.sub;
    const { branch_id } = req.query;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    if (!branch_id) {
        return res.status(400).json({
            error: true,
            message: "branch_id is required.",
        });
    }

    try {
        const result = await graph.query(
            queryQl(TRANSACTION_TYPE, {
                where: {
                    branch_id: { _eq: branch_id },
                },
                order_by: [
                    { transaction_date: "desc" },
                    { created_at: "desc" },
                ],
            })
        );

        return res.status(200).json({
            success: true,
            transactions: result.data?.dcs_transactions || [],
        });
    } catch (error) {
        console.error("Get DCS transactions error:", error);

        return res.status(500).json({
            error: true,
            message: error.message || "Failed to load transactions.",
        });
    }
}