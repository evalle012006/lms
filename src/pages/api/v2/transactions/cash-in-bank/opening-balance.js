import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    queryQl,
    insertQl,
} from "@/lib/graph/graph.util";

const graph = new GraphProvider();

const CASH_IN_BANK_OPENING_TYPE = createGraphType(
    "cash_in_bank_opening_balances",
    `
        id
        branch_id
        bank_no
        balance_month
        opening_balance
        created_at
        updated_at
    `
)("cash_in_bank_opening_balances");

export default apiHandler({
    get: getOpeningBalances,
    post: saveOpeningBalance,
});

const toAmount = (value) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
};

/* =========================================================
   GET OPENING BALANCES
========================================================= */

async function getOpeningBalances(req, res) {
    const userId = req?.auth?.sub;

    const {
        branch_id,
        balance_month,
    } = req.query;

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

    if (!balance_month) {
        return res.status(400).json({
            error: true,
            message: "balance_month is required.",
        });
    }

    try {
        const result = await graph.query(
            queryQl(CASH_IN_BANK_OPENING_TYPE, {
                where: {
                    branch_id: {
                        _eq: branch_id,
                    },

                    balance_month: {
                        _eq: balance_month,
                    },
                },

                order_by: [
                    {
                        bank_no: "asc",
                    },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to load opening balances."
            );
        }

        return res.status(200).json({
            success: true,
            openingBalances:
                result.data?.cash_in_bank_opening_balances ||
                [],
        });
    } catch (error) {
        console.error(
            "Get Cash in Bank opening balances error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to load opening balances.",
        });
    }
}

/* =========================================================
   SAVE / UPDATE OPENING BALANCE
========================================================= */

async function saveOpeningBalance(req, res) {
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
        balance_month,
        opening_balance,
    } = req.body;

    if (!branch_id) {
        return res.status(400).json({
            error: true,
            message: "branch_id is required.",
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

    if (!balance_month) {
        return res.status(400).json({
            error: true,
            message: "balance_month is required.",
        });
    }

    const openingBalance = {
        branch_id,
        bank_no: bankNumber,
        balance_month,
        opening_balance: toAmount(opening_balance),
    };

    try {
        const result = await graph.mutation(
            insertQl(CASH_IN_BANK_OPENING_TYPE, {
                objects: [openingBalance],

                on_conflict: {
                    constraint:
                        "cash_in_bank_opening_balances_branch_id_bank_no_balance_mon_key",

                    update_columns: [
                        "opening_balance",
                        "updated_at",
                    ],
                },
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to save opening balance."
            );
        }

        const savedOpeningBalance =
            result.data?.cash_in_bank_opening_balances
                ?.returning?.[0];

        if (!savedOpeningBalance) {
            throw new Error(
                "Opening balance was not saved."
            );
        }

        return res.status(200).json({
            success: true,
            openingBalance: savedOpeningBalance,
        });
    } catch (error) {
        console.error(
            "Save Cash in Bank opening balance error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to save opening balance.",
        });
    }
}