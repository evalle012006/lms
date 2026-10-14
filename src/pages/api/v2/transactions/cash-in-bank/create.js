import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    insertQl,
} from "@/lib/graph/graph.util";

const graph = new GraphProvider();

const CASH_IN_BANK_ENTRY_TYPE = createGraphType(
    "cash_in_bank_entries",
    `
        id
        branch_id
        bank_no
        transaction_date
        deposit
        net_interest
        withdrawal
        created_at
        updated_at
    `
)("cash_in_bank_entries");

export default apiHandler({
    post: createCashInBankEntry,
});

const toAmount = (value) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
};

async function createCashInBankEntry(req, res) {
    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    const {
        branch_id,
        bank_no,
        transaction_date,
        deposit,
        net_interest,
        withdrawal,
    } = req.body;

    if (!branch_id) {
        return res.status(400).json({
            error: true,
            message: "branch_id is required.",
        });
    }

    if (!transaction_date) {
        return res.status(400).json({
            error: true,
            message: "transaction_date is required.",
        });
    }

    const bankNumber = Number(bank_no);

    if (
        !Number.isInteger(bankNumber) ||
        bankNumber < 1 ||
        bankNumber > 3
    ) {
        return res.status(400).json({
            error: true,
            message: "bank_no must be 1, 2, or 3.",
        });
    }

    const entry = {
        branch_id,
        bank_no: bankNumber,
        transaction_date,
        deposit: toAmount(deposit),
        net_interest: toAmount(net_interest),
        withdrawal: toAmount(withdrawal),
    };

    try {
        const result = await graph.mutation(
            insertQl(CASH_IN_BANK_ENTRY_TYPE, {
                objects: [entry],

                on_conflict: {
                    constraint:
                        "cash_in_bank_entries_branch_id_bank_no_transaction_date_key",
                    update_columns: [
                        "deposit",
                        "net_interest",
                        "withdrawal",
                        "updated_at",
                    ],
                },
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to save Cash in Bank entry."
            );
        }

        const savedEntry =
            result.data?.cash_in_bank_entries?.returning?.[0];

        if (!savedEntry) {
            throw new Error(
                "Cash in Bank entry was not saved."
            );
        }

        return res.status(200).json({
            success: true,
            entry: savedEntry,
        });
    } catch (error) {
        console.error(
            "Create Cash in Bank entry error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to save Cash in Bank entry.",
        });
    }
}