import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

const OTHER_INCOME_TYPE = createGraphType(
    "otherIncomeMiscTransactions",
    `
        _id
        branchId
        transactionDate
        description

        othersAmount
        interestFromBank
        ackpNonAgentCsf
        badDebtCollection

        motorcycleAdvance
        salaryAdvance

        newClientPassbook
        replacementPassbook

        staffExcessRemittance
        penalties

        insertedBy
        insertedByName
        insertedDateTime

        modifiedBy
        modifiedByName
        modifiedDateTime

        branch {
            _id
        }
    `
)("otherIncomeMiscTransactions");

export default apiHandler({
    get: getTransactions,
});

async function getTransactions(req, res) {
    const userId = req?.auth?.sub;
    const { branch_id, transaction_date } = req.query;

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
            branchId: {
                _eq: branch_id,
            },
        };

        if (transaction_date) {
            where.transactionDate = {
                _eq: transaction_date,
            };
        }

        const result = await graph.query(
            queryQl(OTHER_INCOME_TYPE, {
                where,
                order_by: [
                    {
                        transactionDate: "desc",
                    },
                    {
                        insertedDateTime: "desc",
                    },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to load Other Income transactions."
            );
        }

        return res.status(200).json({
            success: true,
            transactions:
                result.data?.otherIncomeMiscTransactions || [],
        });
    } catch (error) {
        console.error(
            "Get Other Income / Misc transactions error:",
            error
        );

        return res.status(500).json({
            error: true,
            message:
                error.message ||
                "Failed to load Other Income / Misc transactions.",
        });
    }
}