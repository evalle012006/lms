import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    queryQl,
    updateQl,
    deleteQl,
    insertQl,
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
    post: updateTransaction,
});

async function updateTransaction(req, res) {
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

    if (!id) {
        return res.status(400).json({
            error: true,
            message: "Transaction ID is required.",
        });
    }

    if (!branch_id) {
        return res.status(400).json({
            error: true,
            message: "Branch is required.",
        });
    }

    if (!paid_to?.trim() || !transaction_date || !voucher_no?.trim()) {
        return res.status(400).json({
            error: true,
            message:
                "Paid to, transaction date and voucher number are required.",
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

    try {
        const existingResult = await graph.query(
            queryQl(TRANSACTION_TYPE, {
                where: {
                    id: { _eq: id },
                    branch_id: { _eq: branch_id },
                },
                limit: 1,
            })
        );

        const existing =
            existingResult.data?.dcs_transactions?.[0];

        if (!existing) {
            return res.status(404).json({
                error: true,
                message: "Transaction not found.",
            });
        }

        const updateResult = await graph.mutation(
            updateQl(TRANSACTION_TYPE, {
                set: {
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
                    updated_at: new Date().toISOString(),
                },
                where: {
                    id: { _eq: id },
                    branch_id: { _eq: branch_id },
                },
            })
        );

        if (updateResult.errors?.length) {
            throw new Error(
                updateResult.errors[0]?.message ||
                    "Failed to update transaction."
            );
        }

        // Replace existing items.
        await graph.mutation(
            deleteQl(ITEM_TYPE, {
                transaction_id: { _eq: id },
            })
        );

        const itemObjects = validItems.map((item) => ({
            transaction_id: id,
            category: String(item.category).trim(),
            code: String(item.code).trim(),
            account_title: String(item.account_title).trim(),
            description:
                String(item.description || "").trim() || null,
            amount: Number(item.amount),
        }));

        const itemResult = await graph.mutation(
            insertQl(ITEM_TYPE, {
                objects: itemObjects,
            })
        );

        if (itemResult.errors?.length) {
            throw new Error(
                itemResult.errors[0]?.message ||
                    "Failed to update transaction items."
            );
        }

        return res.status(200).json({
            success: true,
            transaction:
                updateResult.data?.dcs_transactions?.returning?.[0],
            items:
                itemResult.data?.dcs_transaction_items?.returning || [],
        });
    } catch (error) {
        console.error("Update DCS transaction error:", error);

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
            message: message || "Failed to update transaction.",
        });
    }
}