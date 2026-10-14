import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    queryQl,
    insertQl,
} from "@/lib/graph/graph.util";

const graph = new GraphProvider();

const CASH_IN_BANK_ACCOUNT_TYPE = createGraphType(
    "cash_in_bank_accounts",
    `
        id
        branch_id
        bank_no
        bank_name
        account_no
        created_at
        updated_at
    `
)("cash_in_bank_accounts");

export default apiHandler({
    get: getBankAccounts,
    post: saveBankAccount,
});

/* =========================================================
   GET BANK ACCOUNTS
========================================================= */

async function getBankAccounts(req, res) {
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
            queryQl(CASH_IN_BANK_ACCOUNT_TYPE, {
                where: {
                    branch_id: {
                        _eq: branch_id,
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
                    "Failed to load bank accounts."
            );
        }

        return res.status(200).json({
            success: true,
            accounts:
                result.data?.cash_in_bank_accounts || [],
        });
    } catch (error) {
        console.error(
            "Get Cash in Bank accounts error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to load bank accounts.",
        });
    }
}

/* =========================================================
   SAVE / UPDATE BANK ACCOUNT
========================================================= */

async function saveBankAccount(req, res) {
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
        bank_name,
        account_no,
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

    const account = {
        branch_id,
        bank_no: bankNumber,
        bank_name:
            String(bank_name || "").trim() || null,
        account_no:
            String(account_no || "").trim() || null,
    };

    try {
        const result = await graph.mutation(
            insertQl(CASH_IN_BANK_ACCOUNT_TYPE, {
                objects: [account],

                on_conflict: {
                    constraint:
                        "cash_in_bank_accounts_branch_id_bank_no_key",

                    update_columns: [
                        "bank_name",
                        "account_no",
                        "updated_at",
                    ],
                },
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to save bank account."
            );
        }

        const savedAccount =
            result.data?.cash_in_bank_accounts
                ?.returning?.[0];

        if (!savedAccount) {
            throw new Error(
                "Bank account was not saved."
            );
        }

        return res.status(200).json({
            success: true,
            account: savedAccount,
        });
    } catch (error) {
        console.error(
            "Save Cash in Bank account error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to save bank account.",
        });
    }
}