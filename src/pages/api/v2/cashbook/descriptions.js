//src/pages/api/v2/cashbook/descriptions.js
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    queryQl,
    insertQl,
} from "@/lib/graph/graph.util";

const graph = new GraphProvider();

// =====================================================
// CASHBOOK DESCRIPTION GRAPH TYPE
// =====================================================

const CASHBOOK_DESCRIPTION_TYPE = createGraphType(
    "dcs_cashbook_descriptions",
    `
        id
        branch_id
        entry_date
        description
        created_at
        updated_at
    `
)("dcs_cashbook_descriptions");

// =====================================================
// API HANDLER
// =====================================================

export default apiHandler({
    get: getDescriptions,
    post: saveDescription,
});

// =====================================================
// GET CASHBOOK DESCRIPTIONS
// =====================================================

async function getDescriptions(req, res) {
    try {
        const userId = req?.auth?.sub;

        if (!userId) {
            return res.status(401).json({
                error: true,
                message: "Unauthorized.",
            });
        }

        const { branchId } = req.query;

        if (!branchId) {
            return res.status(400).json({
                error: true,
                message: "Branch ID is required.",
            });
        }

        const result = await graph.query(
            queryQl(CASHBOOK_DESCRIPTION_TYPE, {
                where: {
                    branch_id: {
                        _eq: String(branchId),
                    },
                },
                order_by: [
                    {
                        entry_date: "asc",
                    },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to load Cashbook descriptions."
            );
        }

        const descriptions = {};

        const rows =
            result.data?.dcs_cashbook_descriptions || [];

        rows.forEach((row) => {
            const dateKey = String(
                row.entry_date || ""
            ).slice(0, 10);

            if (dateKey) {
                descriptions[dateKey] =
                    row.description || "";
            }
        });

        return res.status(200).json({
            success: true,
            descriptions,
        });
    } catch (error) {
        console.error(
            "Get Cashbook descriptions error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to load Cashbook descriptions.",
        });
    }
}

// =====================================================
// SAVE OR UPDATE CASHBOOK DESCRIPTION
// =====================================================

async function saveDescription(req, res) {
    try {
        const userId = req?.auth?.sub;

        if (!userId) {
            return res.status(401).json({
                error: true,
                message: "Unauthorized.",
            });
        }

        const {
            branchId,
            date,
            description,
        } = req.body || {};

        if (!branchId || !date) {
            return res.status(400).json({
                error: true,
                message:
                    "Branch ID and date are required.",
            });
        }

        const entryDate = String(date).slice(0, 10);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
            return res.status(400).json({
                error: true,
                message: "Invalid date format.",
            });
        }

        const result = await graph.mutation(
            insertQl(CASHBOOK_DESCRIPTION_TYPE, {
                objects: [
                    {
                        branch_id: String(branchId),
                        entry_date: entryDate,
                        description: String(
                            description || ""
                        ),
                    },
                ],
                on_conflict: {
                    constraint:
                        "dcs_cashbook_descriptions_branch_id_entry_date_key",
                    update_columns: [
                        "description",
                        "updated_at",
                    ],
                },
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to save Cashbook description."
            );
        }

        const saved =
            result.data?.dcs_cashbook_descriptions
                ?.returning?.[0];

        if (!saved) {
            throw new Error(
                "Cashbook description was not saved."
            );
        }

        return res.status(200).json({
            success: true,
            message:
                "Description saved successfully.",
            description: saved,
        });
    } catch (error) {
        console.error(
            "Save Cashbook description error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error?.message ||
                "Failed to save Cashbook description.",
        });
    }
}