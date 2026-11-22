//src/pages/api/v2/transactions/unclaimed-transactions/claim.js
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
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

export default apiHandler({
    post: claimTransaction
});

/**
 * Claim unclaimed transaction(s) with document upload
 * Supports both single and batch mode
 */
async function claimTransaction(req, res) {
    const user_id = req?.auth?.sub;
    const { mode = 'single', transactions } = req.body;

    try {
        // Get current user
        const currentUser = await findUserById(user_id);
        
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Batch mode - process multiple transactions
        if (mode === 'batch' && transactions && Array.isArray(transactions)) {
            logger.debug({
                user_id,
                page: 'Claim Unclaimed Transaction (Batch)',
                message: `Processing ${transactions.length} transactions`
            });

            let successCount = 0;
            let errorCount = 0;
            const results = [];

            for (const tx of transactions) {
                try {
                    const result = await processSingleClaim(tx, user_id);
                    
                    if (result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                    
                    results.push({
                        cashCollectionId: tx.cashCollectionId,
                        clientName: tx.clientName,
                        ...result
                    });
                } catch (error) {
                    errorCount++;
                    logger.error({
                        user_id,
                        page: 'Claim Unclaimed Transaction (Batch)',
                        message: `Error processing transaction ${tx.cashCollectionId}`,
                        error: error.message
                    });
                    
                    results.push({
                        cashCollectionId: tx.cashCollectionId,
                        clientName: tx.clientName,
                        success: false,
                        error: true,
                        message: error.message
                    });
                }
            }

            logger.info({
                user_id,
                page: 'Claim Unclaimed Transaction (Batch)',
                message: 'Batch processing completed',
                total: transactions.length,
                success: successCount,
                errors: errorCount
            });

            return res.status(200).json({
                success: true,
                mode: 'batch',
                total: transactions.length,
                successCount,
                errorCount,
                results
            });
        }

        // Single mode - process one transaction
        const {
            cashCollectionId,
            clientId,
            groupId,
            branchId,
            areaId,
            regionId,
            divisionId,
            loanId
        } = req.body;

        // Validate required fields for single mode
        if (!cashCollectionId || !clientId || resolveDocumentValue(req.body) === null) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: cashCollectionId, clientId, and at least one document are required'
            });
        }

        const result = await processSingleClaim(req.body, user_id);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        logger.error({
            user_id,
            page: 'Claim Unclaimed Transaction',
            message: 'Error in claim handler',
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            success: false,
            message: 'Error claiming transaction',
            error: error.message
        });
    }
}

const MAX_DOCUMENTS = 10;

/**
 * Delete files that were attached to `existing` before this claim and are not
 * part of the new document set. Runs only after the update succeeded.
 * Best-effort: failures are logged, never thrown (the claim is already saved).
 * A key still referenced by any OTHER row is kept (batch claims share files).
 */
async function deleteReplacedDocuments(existing, newDocumentValue, user_id) {
    try {
        const toKey = (v) => {
            const k = extractKeyFromValue(v);
            if (!k) return null;
            try { return decodeURIComponent(k); } catch { return k; }
        };
        const newKeys = new Set(parseDocumentKeys(newDocumentValue).map(toKey).filter(Boolean));
        const allowedPrefix = `${process.env.SPACES_ROOT}/unclaimed-transactions/`;

        const oldKeys = parseDocumentKeys(existing?.document_url)
            .map(toKey)
            .filter(k => k && !newKeys.has(k) && k.startsWith(allowedPrefix) && !k.includes('..'));

        for (const key of oldKeys) {
            const ref = await graph.query(
                queryQl(UNCLAIMED_TRANSACTION_TYPE, {
                    where: {
                        _id: { _neq: existing._id },
                        document_url: { _like: `%${key}%` }
                    },
                    limit: 1
                })
            );
            if (ref.data?.transaction?.length > 0) continue;

            await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.SPACES_BUCKET,
                Key: key,
            }));
        }
    } catch (error) {
        logger.error({
            user_id,
            page: 'Delete Replaced Unclaimed Documents',
            message: 'Failed to delete replaced files (claim already saved)',
            error: error.message
        });
    }
}

/**
 * Normalise the document payload into the value stored in document_url.
 * Accepts `documentUrls` (array of keys) or legacy `documentUrl` (string).
 * Returns null when no usable document is supplied.
 */
function resolveDocumentValue(data) {
    const list = Array.isArray(data?.documentUrls)
        ? data.documentUrls
        : (data?.documentUrl ? [data.documentUrl] : []);
    return serializeDocumentKeys(list.slice(0, MAX_DOCUMENTS));
}

/**
 * Process a single claim transaction
 * @param {Object} transactionData - Transaction data
 * @param {string} user_id - User ID
 * @returns {Promise<Object>} Result object
 */
async function processSingleClaim(transactionData, user_id) {
    const {
        cashCollectionId,
        clientId,
        groupId,
        branchId,
        areaId,
        regionId,
        divisionId,
        loanId
    } = transactionData;

    // Accept documentUrls (array) or legacy documentUrl (string)
    const documentUrl = resolveDocumentValue(transactionData);

    try {
        if (documentUrl === null) {
            return {
                success: false,
                error: true,
                message: 'At least one document is required'
            };
        }

        logger.debug({
            user_id,
            page: 'Process Single Claim',
            cashCollectionId,
            documentUrl
        });

        const currentDate = moment(getSystemDate()).format('YYYY-MM-DD HH:mm:ss');

        // Check if transaction already exists
        const existingTx = await graph.query(
            queryQl(UNCLAIMED_TRANSACTION_TYPE, {
                where: {
                    cash_collection_id: { _eq: cashCollectionId }
                }
            })
        );

        const existing = existingTx.data?.transaction?.[0];

        if (existing) {
            // Update existing transaction
            const updateResult = await graph.mutation(
                updateQl(UNCLAIMED_TRANSACTION_TYPE, {
                    where: {
                        _id: { _eq: existing._id }
                    },
                    set: {
                        status: 'claimed',
                        date_added: currentDate,
                        document_url: documentUrl,
                        modified_by: user_id,
                        modified_date: currentDate
                    }
                })
            );

            // The new documents are saved. Only now remove the files they replace.
            await deleteReplacedDocuments(existing, documentUrl, user_id);

            logger.info({
                user_id,
                page: 'Process Single Claim',
                message: 'Updated existing transaction',
                transactionId: existing._id
            });

            return {
                success: true,
                message: 'Transaction claimed successfully',
                data: updateResult.data?.transaction?.[0],
                operation: 'update'
            };

        } else {
            // Create new transaction record
            const newTransaction = {
                _id: generateUUID(),
                cash_collection_id: cashCollectionId,
                client_id: clientId,
                group_id: groupId || null,
                branch_id: branchId || null,
                area_id: areaId || null,
                region_id: regionId || null,
                division_id: divisionId || null,
                loan_id: loanId || null,
                status: 'claimed',
                date_added: currentDate,
                document_url: documentUrl,
                inserted_by: user_id,
                inserted_date: currentDate
            };

            const insertResult = await graph.mutation(
                insertQl(UNCLAIMED_TRANSACTION_TYPE, {
                    objects: [newTransaction]
                })
            );

            logger.info({
                user_id,
                page: 'Process Single Claim',
                message: 'Created new transaction',
                transactionId: newTransaction._id
            });

            return {
                success: true,
                message: 'Transaction claimed successfully',
                data: insertResult.data?.transaction?.[0],
                operation: 'insert'
            };
        }

    } catch (error) {
        logger.error({
            user_id,
            page: 'Process Single Claim',
            message: 'Error processing claim',
            cashCollectionId,
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: true,
            message: error.message
        };
    }
}