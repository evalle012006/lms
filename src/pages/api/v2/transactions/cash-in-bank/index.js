import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    queryQl,
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
    get: getCashInBankEntries,
});

async function getCashInBankEntries(req, res) {
    const userId = req?.auth?.sub;

    const {
        branch_id,
        month,
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

    try {
        const where = {
            branch_id: {
                _eq: branch_id,
            },
        };

        /*
         * month format:
         * YYYY-MM
         *
         * Example:
         * 2026-09
         */
        if (month && /^\d{4}-\d{2}$/.test(String(month))) {
            const startDate = `${month}-01`;

            const [year, monthNumber] = String(month)
                .split("-")
                .map(Number);

            const nextMonthDate = new Date(
                year,
                monthNumber,
                1
            );

            const nextYear = nextMonthDate.getFullYear();
            const nextMonth = String(
                nextMonthDate.getMonth() + 1
            ).padStart(2, "0");

            const endDate = `${nextYear}-${nextMonth}-01`;

            where.transaction_date = {
                _gte: startDate,
                _lt: endDate,
            };
        }

        const result = await graph.query(
            queryQl(CASH_IN_BANK_ENTRY_TYPE, {
                where,
                order_by: [
                    {
                        transaction_date: "asc",
                    },
                    {
                        bank_no: "asc",
                    },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to load Cash in Bank entries."
            );
        }

        return res.status(200).json({
            success: true,
            entries:
                result.data?.cash_in_bank_entries || [],
        });
    } catch (error) {
        console.error(
            "Get Cash in Bank entries error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to load Cash in Bank entries.",
        });
    }
}