import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    insertQl,
    deleteQl,
} from "@/lib/graph/graph.util";

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
    `
)("dcs_transactions");

const ITEM_TYPE = createGraphType(
    "dcs_transaction_items",
    `
        id
        transaction_id
        category
        code
        account_title
        description
        amount
        created_at
        updated_at
    `
)("dcs_transaction_items");

export default apiHandler({
    post: createTransaction,
});

async function createTransaction(req, res) {
    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    const {
        branch_id,
        paid_to,
        address,
        transaction_date,
        voucher_no,
        total_amount,
        total_amount_words,
        cashier_in_charge,
        supervisor,
        received_by,
        items = [],
    } = req.body;

    if (!branch_id) {
        return res.status(400).json({
            error: true,
            message: "Branch is required.",
        });
    }

    if (!paid_to?.trim()) {
        return res.status(400).json({
            error: true,
            message: "Paid to is required.",
        });
    }

    if (!transaction_date) {
        return res.status(400).json({
            error: true,
            message: "Transaction date is required.",
        });
    }

    if (!voucher_no?.trim()) {
        return res.status(400).json({
            error: true,
            message: "Voucher number is required.",
        });
    }

    const validItems = items.filter(
        (item) =>
            String(item.category || "").trim() &&
            String(item.code || "").trim() &&
            String(item.account_title || "").trim() &&
            Number(item.amount || 0) > 0
    );

    if (validItems.length === 0) {
        return res.status(400).json({
            error: true,
            message: "At least one valid transaction item is required.",
        });
    }

    const cashier = String(cashier_in_charge || "")
        .trim()
        .toLowerCase();

    const receiver = String(received_by || "")
        .trim()
        .toLowerCase();

    if (cashier && receiver && cashier === receiver) {
        return res.status(400).json({
            error: true,
            message:
                "Cashier in Charge and Received By cannot be the same person.",
        });
    }

    let transactionId = null;

    try {
        const headerResult = await graph.mutation(
            insertQl(TRANSACTION_TYPE, {
                objects: [
                    {
                        branch_id,
                        created_by: userId,
                        paid_to: paid_to.trim(),
                        address: address?.trim() || null,
                        transaction_date,
                        voucher_no: voucher_no.trim(),
                        total_amount: Number(total_amount || 0),
                        total_amount_words:
                            total_amount_words?.trim() || null,
                        cashier_in_charge:
                            cashier_in_charge?.trim() || null,
                        supervisor: supervisor?.trim() || null,
                        received_by: received_by?.trim() || null,
                    },
                ],
            })
        );

        if (headerResult.errors?.length) {
            throw new Error(
                headerResult.errors[0]?.message ||
                    "Failed to create transaction."
            );
        }

        const transaction =
            headerResult.data?.dcs_transactions?.returning?.[0];

        if (!transaction) {
            throw new Error("Transaction header was not created.");
        }

        transactionId = transaction.id;

        const itemObjects = validItems.map((item) => ({
            transaction_id: transaction.id,
            category: String(item.category).trim(),
            code: String(item.code).trim(),
            account_title: String(item.account_title).trim(),
            description:
                String(item.description || "").trim() || null,
            amount: Number(item.amount),
        }));

        const itemsResult = await graph.mutation(
            insertQl(ITEM_TYPE, {
                objects: itemObjects,
            })
        );

        if (itemsResult.errors?.length) {
            throw new Error(
                itemsResult.errors[0]?.message ||
                    "Failed to save transaction items."
            );
        }

        return res.status(200).json({
            success: true,
            transaction,
            items:
                itemsResult.data?.dcs_transaction_items?.returning || [],
        });
    } catch (error) {
        /*
         * Header and items are currently two GraphProvider mutations.
         * If item creation fails after the header was created,
         * remove the header. ON DELETE CASCADE also removes any
         * partially-created items.
         */
        if (transactionId) {
            try {
                await graph.mutation(
                    deleteQl(TRANSACTION_TYPE, {
                        id: { _eq: transactionId },
                    })
                );
            } catch (cleanupError) {
                console.error(
                    "DCS transaction cleanup failed:",
                    cleanupError
                );
            }
        }

        console.error("Create DCS transaction error:", error);

        const message = String(error?.message || "");

        if (
            message.includes("uq_dcs_transaction_branch_voucher") ||
            message.toLowerCase().includes("unique constraint")
        ) {
            return res.status(200).json({
                error: true,
                message:
                    "This voucher number already exists for this branch.",
            });
        }

        return res.status(500).json({
            error: true,
            message: message || "Failed to save transaction.",
        });
    }
}