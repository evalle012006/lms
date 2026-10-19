import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    insertQl,
} from "@/lib/graph/graph.util";

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
    `
)("otherIncomeMiscTransactions");

export default apiHandler({
    post: createTransaction,
});

const toAmount = (value) => {
    const number = Number(value ?? 0);

    return Number.isFinite(number) ? number : 0;
};

async function createTransaction(req, res) {
    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized.",
        });
    }

    const {
        _id,
        branchId,
        transactionDate,
        description,

        othersAmount,
        interestFromBank,
        ackpNonAgentCsf,
        badDebtCollection,

        motorcycleAdvance,
        salaryAdvance,

        newClientPassbook,
        replacementPassbook,

        staffExcessRemittance,
        penalties,

        insertedByName,
    } = req.body;

    if (!branchId) {
        return res.status(400).json({
            error: true,
            message: "Branch is required.",
        });
    }

    if (!transactionDate) {
        return res.status(400).json({
            error: true,
            message: "Transaction date is required.",
        });
    }

    if (!_id) {
        return res.status(400).json({
            error: true,
            message: "Transaction ID is required.",
        });
    }

    const amounts = {
        othersAmount: toAmount(othersAmount),
        interestFromBank: toAmount(interestFromBank),
        ackpNonAgentCsf: toAmount(ackpNonAgentCsf),
        badDebtCollection: toAmount(badDebtCollection),

        motorcycleAdvance: toAmount(motorcycleAdvance),
        salaryAdvance: toAmount(salaryAdvance),

        newClientPassbook: toAmount(newClientPassbook),
        replacementPassbook: toAmount(replacementPassbook),

        staffExcessRemittance: toAmount(staffExcessRemittance),
        penalties: toAmount(penalties),
    };

    const total = Object.values(amounts).reduce(
        (sum, amount) => sum + amount,
        0
    );

    if (total <= 0) {
        return res.status(400).json({
            error: true,
            message:
                "Please enter an amount for at least one Other Income item.",
        });
    }

    try {
        const result = await graph.mutation(
            insertQl(OTHER_INCOME_TYPE, {
                objects: [
                    {
                        _id,
                        branchId,
                        transactionDate,

                        description:
                            String(description || "").trim() || null,

                        ...amounts,

                        insertedBy: userId,
                        insertedByName:
                            String(insertedByName || "").trim() || null,
                    },
                ],
            })
        );

        if (result.errors?.length) {
            throw new Error(
                result.errors[0]?.message ||
                    "Failed to create Other Income transaction."
            );
        }

        const transaction =
            result.data?.otherIncomeMiscTransactions?.returning?.[0];

        if (!transaction) {
            throw new Error(
                "Other Income transaction was not created."
            );
        }

        return res.status(200).json({
            success: true,
            transaction,
        });
    } catch (error) {
        console.error(
            "Create Other Income / Misc transaction error:",
            error
        );

        const message = String(error?.message || "");

        return res.status(500).json({
            error: true,
            message:
                message ||
                "Failed to save Other Income / Misc transaction.",
        });
    }
}