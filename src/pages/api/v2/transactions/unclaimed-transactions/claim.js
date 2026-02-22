import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl, queryQl } from '@/lib/graph/graph.util';
import { UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import { generateUUID } from '@/lib/utils';
import { getSystemDate } from '@/lib/date-utils';
import logger from '@/logger';
import moment from 'moment';

const graph = new GraphProvider();

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
            loanId,
            documentUrl
        } = req.body;

        // Validate required fields for single mode
        if (!cashCollectionId || !clientId || !documentUrl) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: cashCollectionId, clientId, and documentUrl are required'
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
        loanId,
        documentUrl
    } = transactionData;

    try {
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