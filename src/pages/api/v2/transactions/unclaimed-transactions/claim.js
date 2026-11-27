import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { calculateOffsetAmounts } from "@/lib/unclaimed-calculations";
import { createGraphType, insertQl, updateQl, queryQl } from '@/lib/graph/graph.util';
import { UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import { generateUUID } from '@/lib/utils';
import { getSystemDate } from '@/lib/date-utils';
import { serializeDocumentKeys, parseDocumentKeys, extractKeyFromValue } from '@/lib/fileUtils';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import logger from '@/logger';
import moment from 'moment';

const graph = new GraphProvider();

const s3Client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId: process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

const UNCLAIMED_TRANSACTION_TYPE = createGraphType(
    'unclaimed_amount_transactions',
    UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS
)('transaction');

const CASH_COLLECTION_TYPE = createGraphType(
    'cashCollections',
    `
        _id
        clientId
        groupId
        branchId
        loanId
        loId
        dateAdded
        mcbuReturnAmt
        csfReturnAmt
        paymentCollection
        remarks

        branch {
            _id
            areaId
            regionId
            divisionId
        }
    `
)('cashCollections');

export default apiHandler({
    post: claimTransaction
});

const toNumber = (value) => {
    const amount = Number(value ?? 0);

    return Number.isFinite(amount)
        ? amount
        : 0;
};

const roundMoney = (value) =>
    Math.round(toNumber(value) * 100) / 100;

const checkGraphResult = (result) => {
    if (result?.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    return result;
};

function failure(message, statusCode = 400) {
    return {
        success: false,
        error: true,
        statusCode,
        message
    };
}

function canClaimTransaction(currentUser, transaction) {
    const role = currentUser.role || {};
    const roleRep = Number(role.rep);

    const shortCode = String(
        role.shortCode || ''
    ).toLowerCase();

    if (roleRep === 1) {
        return true;
    }

    if (roleRep === 3) {
        return Boolean(
            currentUser.designatedBranchId &&
            transaction.branch_id &&
            String(currentUser.designatedBranchId) ===
            String(transaction.branch_id)
        );
    }

    if (
        shortCode === 'area_admin' ||
        shortCode === 'area_manager'
    ) {
        return Boolean(
            currentUser.areaId &&
            transaction.area_id &&
            String(currentUser.areaId) ===
            String(transaction.area_id)
        );
    }

    if (shortCode === 'regional_manager') {
        return Boolean(
            currentUser.regionId &&
            transaction.region_id &&
            String(currentUser.regionId) ===
            String(transaction.region_id)
        );
    }

    if (shortCode === 'deputy_director') {
        return Boolean(
            currentUser.divisionId &&
            transaction.division_id &&
            String(currentUser.divisionId) ===
            String(transaction.division_id)
        );
    }

    if (roleRep === 4) {
        return Boolean(
            currentUser._id &&
            transaction.lo_id &&
            String(currentUser._id) ===
            String(transaction.lo_id)
        );
    }

    return false;
}

async function claimTransaction(req, res) {
    const userId = req?.auth?.sub;

    try {
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const currentUser = await findUserById(userId);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const {
            mode = 'single',
            transactions
        } = req.body || {};

        if (!['single', 'batch'].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid claim mode.'
            });
        }

        if (mode === 'batch') {
            if (
                !Array.isArray(transactions) ||
                transactions.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'No transactions selected.'
                });
            }

            let successCount = 0;
            let errorCount = 0;

            const results = [];

            for (const tx of transactions) {
                const result = await processSingleClaim(
                    tx,
                    currentUser,
                    userId
                );

                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }

                results.push({
                    cashCollectionId: tx?.cashCollectionId || null,
                    transactionId: tx?.transactionId || null,
                    sourceType: tx?.sourceType || 'offset',
                    clientName: tx?.clientName || '',
                    ...result
                });
            }

            return res.status(200).json({
                success: errorCount === 0,
                mode: 'batch',
                total: transactions.length,
                successCount,
                errorCount,
                results
            });
        }

        const result = await processSingleClaim(
            req.body,
            currentUser,
            userId
        );

        return res.status(
            result.success
                ? 200
                : result.statusCode || 500
        ).json(result);

    } catch (error) {
        logger.error({
            userId,
            page: 'Claim Unclaimed Transaction',
            message: 'Error in claim handler',
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            success: false,
            message: 'Error claiming transaction.'
        });
    }
}

const MAX_DOCUMENTS = 10;

async function deleteReplacedDocuments(existing, newDocumentValue, userId) {
    try {
        const toKey = (v) => {
            const k = extractKeyFromValue(v);
            if (!k) return null;

            try {
                return decodeURIComponent(k);
            } catch {
                return k;
            }
        };

        const newKeys = new Set(
            parseDocumentKeys(newDocumentValue)
                .map(toKey)
                .filter(Boolean)
        );

        const allowedPrefix =
            `${process.env.SPACES_ROOT}/unclaimed-transactions/`;

        const oldKeys = parseDocumentKeys(existing?.document_url)
            .map(toKey)
            .filter(k =>
                k &&
                !newKeys.has(k) &&
                k.startsWith(allowedPrefix) &&
                !k.includes('..')
            );

        for (const key of oldKeys) {
            const ref = checkGraphResult(
                await graph.query(
                    queryQl(UNCLAIMED_TRANSACTION_TYPE, {
                        where: {
                            _id: { _neq: existing._id },
                            document_url: { _like: `%${key}%` }
                        },
                        limit: 1
                    })
                )
            );

            if (ref.data?.transaction?.length > 0) continue;

            await s3Client.send(
                new DeleteObjectCommand({
                    Bucket: process.env.SPACES_BUCKET,
                    Key: key
                })
            );
        }
    } catch (error) {
        logger.error({
            user_id: userId,
            page: 'Delete Replaced Unclaimed Documents',
            message: 'Failed to delete replaced files',
            error: error.message
        });
    }
}

function resolveDocumentValue(data) {
    const list = Array.isArray(data?.documentUrls)
        ? data.documentUrls
        : (data?.documentUrl ? [data.documentUrl] : []);

    return serializeDocumentKeys(
        list.slice(0, MAX_DOCUMENTS)
    );
}

async function processSingleClaim(
    transactionData,
    currentUser,
    userId
) {
    try {
        const {
            sourceType,
            transactionId,
            cashCollectionId
        } = transactionData || {};

        const documentUrl = resolveDocumentValue(transactionData);

        if (
            typeof documentUrl !== 'string' ||
            !documentUrl.trim()
        ) {
            return failure(
                'At least one claim document is required.'
            );
        }

        const isManual =
            sourceType === 'manual' ||
            (!cashCollectionId && transactionId);

        if (isManual) {
            if (!transactionId) {
                return failure(
                    'Manual transaction ID is required.'
                );
            }

            return await claimManualTransaction(
                transactionId,
                documentUrl,
                currentUser,
                userId
            );
        }

        if (!cashCollectionId) {
            return failure(
                'Cash Collection ID is required.'
            );
        }

        return await claimOffsetTransaction(
            cashCollectionId,
            documentUrl,
            currentUser,
            userId
        );

    } catch (error) {
        logger.error({
            userId,
            page: 'Process Single Claim',
            error: error.message,
            stack: error.stack
        });

        return failure(
            'Failed to claim transaction.',
            500
        );
    }
}


async function claimManualTransaction(transactionId, documentUrl, currentUser, userId) {
    const existingResult = checkGraphResult(
        await graph.query(
            queryQl(UNCLAIMED_TRANSACTION_TYPE, {
                where: {
                    _id: {_eq: transactionId},
                    source_type: {_eq: 'manual'}
                },
                limit: 1
            })
        )
    );

    const existing = existingResult.data?.transaction?.[0];

    if (!existing) {
        return failure(
            'Manual unclaimed transaction not found.',
            404
        );
    }

    if (
        !canClaimTransaction(
            currentUser,
            existing
        )
    ) {
        return failure(
            'You cannot claim this transaction.',
            403
        );
    }

    if (existing.status !== 'unclaimed') {
        return failure(
            'This transaction is no longer unclaimed.',
            409
        );
    }

    const totalAmount = roundMoney(
        toNumber(existing.mcbu_amount) +
        toNumber(existing.csf_amount)
    );

    if (totalAmount <= 0) {
        return failure(
            'Unclaimed amount must be greater than zero.'
        );
    }

    const currentDate = moment(
        getSystemDate()
    ).format('YYYY-MM-DD HH:mm:ss');

    const currentDay = currentDate.slice(0, 10);

    if (
        !existing.entry_date ||
        existing.entry_date > currentDay
    ) {
        return failure(
            'Invalid transaction entry date.'
        );
    }

    const updateResult = checkGraphResult(
        await graph.mutation(
            updateQl(UNCLAIMED_TRANSACTION_TYPE, {
                where: {
                    _id: {_eq: existing._id},
                    source_type: {_eq: 'manual'},
                    status: {_eq: 'unclaimed'}
                },

                set: {
                    status: 'claimed',
                    date_added: currentDate,
                    document_url: documentUrl.trim(),
                    modified_by: userId,
                    modified_date: currentDate
                }
            })
        )
    );

    const mutation =
        updateResult.data?.transaction ||
        updateResult.data
            ?.update_unclaimed_amount_transactions;

    const updated = Array.isArray(mutation) ? mutation[0] : mutation?.returning?.[0];

    if (!updated) {
        return failure(
            'Transaction was already claimed or could not be updated.',
            409
        );
    }

    await deleteReplacedDocuments(existing, documentUrl, userId);

    return {
        success: true,
        message: 'MCBU / CSF claimed successfully.',
        sourceType: 'manual',
        transactionId: existing._id,
        operation: 'update',
        data: updated,
        unclaimedAmount: totalAmount
    };
}

async function claimOffsetTransaction(
    cashCollectionId,
    documentUrl,
    currentUser,
    userId
) {
    const collectionResult = checkGraphResult(
        await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {_id: {_eq: cashCollectionId}, remarks: {_contains: {value: 'offset-unclaimed'}}},
                limit: 1
            })
        )
    );

    const collection = collectionResult.data?.cashCollections?.[0];

    if (!collection) {
        return failure(
            'Unclaimed cash collection not found.',
            404
        );
    }

    const transactionInfo = {
        client_id: collection.clientId,
        group_id: collection.groupId || null,
        branch_id: collection.branchId || null,
        area_id: collection.branch?.areaId || null,
        region_id: collection.branch?.regionId || null,
        division_id: collection.branch?.divisionId || null,
        loan_id: collection.loanId || null,
        lo_id: collection.loId || null
    };

    if (
        !canClaimTransaction(
            currentUser,
            transactionInfo
        )
    ) {
        return failure(
            'You cannot claim this transaction.',
            403
        );
    }

    const { unclaimedAmount } = calculateOffsetAmounts(collection);

    if (unclaimedAmount <= 0) {
        return failure(
            'Unclaimed amount must be greater than zero.'
        );
    }

    const currentDate = moment(
        getSystemDate()
    ).format('YYYY-MM-DD HH:mm:ss');

    const currentDay = currentDate.slice(0, 10);

    if (
        !collection.dateAdded ||
        String(collection.dateAdded).slice(0, 10) >
            currentDay
    ) {
        return failure(
            'Invalid offset transaction date.'
        );
    }

    const existingResult = checkGraphResult(
        await graph.query(
            queryQl(UNCLAIMED_TRANSACTION_TYPE, {
                where: {
                    source_type: {
                        _eq: 'offset'
                    },

                    cash_collection_id: {
                        _eq: cashCollectionId
                    }
                }
            })
        )
    );

    const existingTransactions = existingResult.data?.transaction || [];

    if (existingTransactions.length > 1) {
        return failure(
            'Duplicate offset records detected. Please contact the administrator.',
            409
        );
    }

    const existing = existingTransactions[0];

    if (existing) {
        if (existing.status !== 'unclaimed') {
            return failure(
                'This transaction is no longer unclaimed.',
                409
            );
        }

        const updateResult = checkGraphResult(
            await graph.mutation(
                updateQl(
                    UNCLAIMED_TRANSACTION_TYPE,
                    {
                        where: {_id: {_eq: existing._id},
                            source_type: {_eq: 'offset'},
                            status: {_eq: 'unclaimed'}
                        },

                        set: {
                            status: 'claimed',
                            date_added: currentDate,
                            document_url: documentUrl.trim(),
                            modified_by: userId,
                            modified_date: currentDate
                        }
                    }
                )
            )
        );

        const mutation =
            updateResult.data?.transaction ||
            updateResult.data
                ?.update_unclaimed_amount_transactions;

        const updated = Array.isArray(mutation) ? mutation[0] : mutation?.returning?.[0];

        if (!updated) {
            return failure(
                'Transaction was already claimed or could not be updated.',
                409
            );
        }

    await deleteReplacedDocuments(existing, documentUrl, userId);

        return {
            success: true,
            message: 'Transaction claimed successfully.',
            sourceType: 'offset',
            transactionId: existing._id,
            operation: 'update',
            data: updated,
            unclaimedAmount
        };
    }

    const newTransaction = {
        _id: generateUUID(),
        source_type: 'offset',
        cash_collection_id: cashCollectionId,

        ...transactionInfo,

        status: 'claimed',
        date_added: currentDate,
        document_url: documentUrl.trim(),
        inserted_by: userId,
        inserted_date: currentDate
    };

    const insertResult = checkGraphResult(
        await graph.mutation(
            insertQl(UNCLAIMED_TRANSACTION_TYPE, {
                objects: [newTransaction]
            })
        )
    );

    const mutation =
        insertResult.data?.transaction ||
        insertResult.data
            ?.insert_unclaimed_amount_transactions;

    const inserted = Array.isArray(mutation) ? mutation[0] : mutation?.returning?.[0];

    if (!inserted) {
        throw new Error(
            'Unable to create offset claim record.'
        );
    }

    return {
        success: true,
        message: 'Transaction claimed successfully.',
        sourceType: 'offset',
        transactionId: inserted._id,
        operation: 'insert',
        data: inserted,
        unclaimedAmount
    };
}