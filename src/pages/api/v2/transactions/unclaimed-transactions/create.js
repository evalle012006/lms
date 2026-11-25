//src/pages/api/v2/transactions/unclaimed-transactions/create.js
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
    createGraphType,
    insertQl,
    queryQl,
} from "@/lib/graph/graph.util";

import {
    UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS,
} from "@/lib/graph.fields";

import { findUserById } from "@/lib/graph.functions";
import { generateUUID } from "@/lib/utils";
import { getSystemDate } from "@/lib/date-utils";
import logger from "@/logger";
import moment from "moment";

const graph = new GraphProvider();

// =====================================================
// GRAPHQL TYPES
// =====================================================

const UNCLAIMED_TRANSACTION_TYPE = createGraphType(
    "unclaimed_amount_transactions",
    UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS
)("transaction");

const CLIENT_TYPE = createGraphType(
    "client",
    `
        _id
        firstName
        lastName
        fullName
        branchId
        groupId
        loId
    `
)("client");

const BRANCH_TYPE = createGraphType(
    "branches",
    `
        _id
        name
        areaId
        regionId
        divisionId
    `
)("branches");

const GROUP_TYPE = createGraphType(
    "groups",
    `
        _id
        name
        branchId
        loanOfficerId
    `
)("groups");

const LOAN_TYPE = createGraphType(
    "loans",
    `
        _id
        clientId
        branchId
        groupId
        loId
        slotNo
        dateAdded
    `
)("loans");

// =====================================================
// API HANDLER
// =====================================================

export default apiHandler({
    post: createUnclaimedTransaction,
});

// =====================================================
// HELPERS
// =====================================================

const toStr = (value) =>
    String(value ?? "").trim();

const parseAmount = (value) => {
    const text = toStr(value ?? 0) || "0";

    if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
        return null;
    }

    const amount = Number(text);

    return Number.isFinite(amount) && amount >= 0
        ? amount
        : null;
};

const checkGraphResult = (result) => {
    if (result?.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    return result;
};

// =====================================================
// CREATE MANUAL MCBU / CSF IN
// =====================================================

async function createUnclaimedTransaction(req, res) {
    try {
        const userId = req?.auth?.sub;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        const currentUser = await findUserById(userId);

        if (!currentUser) {
            return res.status(403).json({
                success: false,
                message: "User account not found.",
            });
        }

        const roleRep = Number(currentUser.role?.rep);

        const isAdmin = roleRep === 1;
        const isBranchManager = roleRep === 3;

        // Initially allow Admin and Branch Manager only.
        if (!isAdmin && !isBranchManager) {
            return res.status(403).json({
                success: false,
                message:
                    "You do not have permission to register MCBU / CSF In.",
            });
        }

        const {
            branchId,
            loId,
            groupId,
            clientId,
            entryDate,
            mcbuAmount,
            csfAmount,
            remarks,
        } = req.body || {};

        // =================================================
        // VALIDATION
        // =================================================

        if (!branchId || !loId || !groupId || !clientId) {
            return res.status(400).json({
                success: false,
                message:
                    "Branch, Loan Officer, Group and Client are required.",
            });
        }

        if (
            !entryDate ||
            !moment(entryDate, "YYYY-MM-DD", true).isValid()
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid entry date is required.",
            });
        }

        const systemDate = moment(getSystemDate())
            .format("YYYY-MM-DD");

        if (entryDate > systemDate) {
            return res.status(400).json({
                success: false,
                message: "Entry date cannot be in the future.",
            });
        }

        const mcbu = parseAmount(mcbuAmount);
        const csf = parseAmount(csfAmount);

        if (mcbu === null || csf === null) {
            return res.status(400).json({
                success: false,
                message:
                    "MCBU and CSF must be valid non-negative amounts.",
            });
        }

        const totalAmount =
            Math.round((mcbu + csf) * 100) / 100;

        if (totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Total unclaimed amount must be greater than zero.",
            });
        }

        // =================================================
        // BRANCH PERMISSION
        // =================================================

        if (
            isBranchManager &&
            toStr(currentUser.designatedBranchId) !==
                toStr(branchId)
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You can only register transactions for your assigned branch.",
            });
        }

        // =================================================
        // VERIFY BRANCH
        // =================================================

        const branchResult = checkGraphResult(
            await graph.query(
                queryQl(BRANCH_TYPE, {
                    where: {
                        _id: { _eq: branchId },
                    },
                    limit: 1,
                })
            )
        );

        const branch = branchResult.data?.branches?.[0];

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Branch not found.",
            });
        }

        // =================================================
        // VERIFY GROUP AND LOAN OFFICER
        // =================================================

        const groupResult = checkGraphResult(
            await graph.query(
                queryQl(GROUP_TYPE, {
                    where: {
                        _id: { _eq: groupId },
                        branchId: { _eq: branchId },
                        loanOfficerId: { _eq: loId },
                    },
                    limit: 1,
                })
            )
        );

        const group = groupResult.data?.groups?.[0];

        if (!group) {
            return res.status(400).json({
                success: false,
                message:
                    "The selected group does not belong to the selected Loan Officer or branch.",
            });
        }

        // =================================================
        // VERIFY CLIENT
        // =================================================

        const clientResult = checkGraphResult(
            await graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        _id: { _eq: clientId },
                        branchId: { _eq: branchId },
                        groupId: { _eq: groupId },
                        loId: { _eq: loId },
                    },
                    limit: 1,
                })
            )
        );

        const client = clientResult.data?.client?.[0];

        if (!client) {
            return res.status(400).json({
                success: false,
                message:
                    "The selected client does not belong to the selected branch, group or Loan Officer.",
            });
        }

        // =================================================
        // GET CLIENT LOAN AND SLOT NUMBER
        // =================================================

        const loanResult = checkGraphResult(
            await graph.query(
                queryQl(LOAN_TYPE, {
                    where: {
                        clientId: { _eq: clientId },
                        branchId: { _eq: branchId },
                        groupId: { _eq: groupId },
                        loId: { _eq: loId },
                    },
                    order_by: [
                        { dateAdded: "desc" },
                    ],
                    limit: 1,
                })
            )
        );

        const loan = loanResult.data?.loans?.[0];

        const currentDate = moment(getSystemDate())
            .format("YYYY-MM-DD HH:mm:ss");

        // =================================================
        // PREPARE MANUAL UNCLAIMED TRANSACTION
        // =================================================

        const transactionData = {
            _id: generateUUID(),

            source_type: "manual",

            client_id: client._id,
            group_id: group._id,
            branch_id: branch._id,

            area_id: branch.areaId || null,
            region_id: branch.regionId || null,
            division_id: branch.divisionId || null,

            lo_id: group.loanOfficerId,

            loan_id: loan?._id || null,

            // Manual entries have no cash collection record.
            cash_collection_id: null,

            entry_date: entryDate,

            mcbu_amount: mcbu,
            csf_amount: csf,

            remarks: toStr(remarks) || null,

            status: "unclaimed",

            // Claiming date remains empty until claimed.
            date_added: null,

            document_url: null,

            inserted_by: userId,
            inserted_date: currentDate,

            modified_by: null,
            modified_date: null,
        };

        // =================================================
        // SAVE TRANSACTION
        // =================================================

        const insertResult = checkGraphResult(
            await graph.mutation(
                insertQl(UNCLAIMED_TRANSACTION_TYPE, {
                    objects: [transactionData],
                })
            )
        );

        const transaction =
            insertResult.data?.transaction?.returning?.[0] ||
            insertResult.data
                ?.unclaimed_amount_transactions
                ?.returning?.[0];

        if (!transaction) {
            throw new Error(
                "Unable to create unclaimed transaction."
            );
        }

        return res.status(201).json({
            success: true,
            message: "MCBU / CSF In registered successfully.",

            data: {
                ...transaction,

                transactionId: transaction._id,
                sourceType: "manual",

                clientName:
                    client.fullName ||
                    `${client.firstName || ""} ${client.lastName || ""}`.trim(),

                branchName: branch.name,
                groupName: group.name,

                slotNo: loan?.slotNo ?? null,

                mcbu,
                csf,
                unclaimedAmount: totalAmount,
            },
        });

    } catch (error) {
        logger.error(
            "Create manual unclaimed transaction error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to register MCBU / CSF In.",
        });
    }
}