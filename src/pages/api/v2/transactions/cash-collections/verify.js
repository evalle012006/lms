/**
 * Verify and Repair Cash Collection Transactions API
 * 
 * This API checks for discrepancies between cash_collections and loans tables
 * and optionally repairs them.
 * 
 * POST /api/v2/transactions/cash-collections/verify
 * Body: {
 *   groupId: string,
 *   dateAdded: string (YYYY-MM-DD),
 *   repair: boolean (optional, default false)
 * }
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     collectionCount: number,
 *     loanCount: number,
 *     discrepancyCount: number,
 *     discrepancies: array,
 *     status: 'OK' | 'NO_DATA' | 'DISCREPANCIES_FOUND' | 'REPAIRED',
 *     repairResults?: { repaired: array, failed: array }
 *   }
 * }
 */

import { LOAN_FIELDS, CASH_COLLECTIONS_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { safeNumber } from '@/lib/utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const LOAN_TYPE = createGraphType('loans', LOAN_FIELDS);
const CC_TYPE = createGraphType('cashCollections', CASH_COLLECTIONS_FIELDS);

export default apiHandler({
    post: verifyAndRepair
});

async function verifyAndRepair(req, res) {
    const user_id = req?.auth?.sub;
    const { groupId, dateAdded, repair = false } = req.body;

    if (!groupId || !dateAdded) {
        return res.status(400).json({
            success: false,
            error: true,
            message: 'groupId and dateAdded are required'
        });
    }

    try {
        logger.debug({
            user_id,
            page: 'Verify Transaction',
            message: 'Starting verification',
            groupId,
            dateAdded,
            repair
        });

        // Get all cash collections for this group and date
        // Exclude drafts, pending, tomorrow, and totals
        const collections = await graph.query(
            queryQl(CC_TYPE('collections'), {
                where: {
                    groupId: { _eq: groupId },
                    dateAdded: { _eq: dateAdded },
                    status: { _nin: ['tomorrow', 'pending', 'totals'] },
                    draft: { _neq: true }
                }
            })
        ).then(res => res.data.collections || []);

        if (collections.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    collectionCount: 0,
                    loanCount: 0,
                    discrepancyCount: 0,
                    discrepancies: [],
                    status: 'NO_DATA'
                }
            });
        }

        // Get unique loan IDs from collections
        const loanIds = [...new Set(collections.map(c => c.loanId).filter(Boolean))];

        if (loanIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    collectionCount: collections.length,
                    loanCount: 0,
                    discrepancyCount: 0,
                    discrepancies: [],
                    status: 'NO_LOANS'
                }
            });
        }

        // Get corresponding loans
        const loans = await graph.query(
            queryQl(LOAN_TYPE('loans'), {
                where: { _id: { _in: loanIds } }
            })
        ).then(res => res.data.loans || []);

        // Create a map of loans for quick lookup
        const loanMap = new Map(loans.map(l => [l._id, l]));

        // Find discrepancies
        const discrepancies = [];

        for (const cc of collections) {
            if (!cc.loanId) continue;
            
            const loan = loanMap.get(cc.loanId);

            if (!loan) {
                discrepancies.push({
                    type: 'LOAN_NOT_FOUND',
                    clientId: cc.clientId,
                    loanId: cc.loanId,
                    clientName: cc.clientName || cc.name,
                    slotNo: cc.slotNo,
                    ccData: {
                        loanBalance: cc.loanBalance,
                        noOfPayments: cc.noOfPayments,
                        mcbu: cc.mcbu,
                        status: cc.status
                    }
                });
                continue;
            }

            // Check if loan was updated on the same date
            // This is our primary indicator that the loan update was missed
            const loanLastUpdated = loan.lastUpdated || loan.dateModified;
            
            if (loanLastUpdated !== dateAdded) {
                // Additional check: verify if values actually differ
                const ccLoanBalance = safeNumber(cc.loanBalance);
                const loanBalance = safeNumber(loan.loanBalance);
                const ccNoOfPayments = cc.noOfPayments === '-' ? 0 : safeNumber(cc.noOfPayments);
                const loanNoOfPayments = safeNumber(loan.noOfPayments);
                
                // Only flag as discrepancy if values actually differ
                // OR if lastUpdated doesn't match (indicating missed update)
                const hasValueMismatch = 
                    ccLoanBalance !== loanBalance || 
                    ccNoOfPayments !== loanNoOfPayments;
                
                if (hasValueMismatch || loanLastUpdated !== dateAdded) {
                    discrepancies.push({
                        type: 'LOAN_NOT_UPDATED',
                        clientId: cc.clientId,
                        loanId: cc.loanId,
                        clientName: cc.clientName || cc.name,
                        slotNo: cc.slotNo,
                        expected: dateAdded,
                        actual: loanLastUpdated,
                        ccData: {
                            loanBalance: ccLoanBalance,
                            noOfPayments: ccNoOfPayments,
                            mcbu: safeNumber(cc.mcbu),
                            mcbuCol: safeNumber(cc.mcbuCol),
                            status: cc.status
                        },
                        loanData: {
                            loanBalance: loanBalance,
                            noOfPayments: loanNoOfPayments,
                            mcbu: safeNumber(loan.mcbu),
                            mcbuCollection: safeNumber(loan.mcbuCollection),
                            status: loan.status,
                            lastUpdated: loanLastUpdated
                        }
                    });
                }
            }
        }

        logger.debug({
            user_id,
            page: 'Verify Transaction',
            message: 'Verification complete',
            groupId,
            collectionCount: collections.length,
            loanCount: loans.length,
            discrepancyCount: discrepancies.length
        });

        // If repair is requested and there are discrepancies, fix them
        let repairResults = null;
        if (repair && discrepancies.length > 0) {
            repairResults = await repairDiscrepancies(user_id, discrepancies, collections, dateAdded);
        }

        const status = discrepancies.length === 0 ? 'OK' : 
                       repair && repairResults?.repaired?.length > 0 ? 'REPAIRED' : 
                       'DISCREPANCIES_FOUND';

        res.status(200).json({
            success: true,
            data: {
                collectionCount: collections.length,
                loanCount: loans.length,
                discrepancyCount: discrepancies.length,
                discrepancies: discrepancies,
                status: status,
                repairResults: repairResults
            }
        });

    } catch (error) {
        logger.error({
            user_id,
            page: 'Verify Transaction',
            message: 'Verification failed',
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            error: true,
            message: 'Failed to verify transaction: ' + error.message
        });
    }
}

/**
 * Repair discrepancies by updating loans to match cash collections
 */
async function repairDiscrepancies(user_id, discrepancies, collections, dateAdded) {
    const mutationQl = [];
    const repaired = [];
    const failed = [];

    logger.info({
        user_id,
        page: 'Verify Transaction',
        message: 'Starting repair',
        discrepancyCount: discrepancies.length
    });

    for (const disc of discrepancies) {
        // Skip LOAN_NOT_FOUND - we can't repair if the loan doesn't exist
        if (disc.type === 'LOAN_NOT_FOUND') {
            failed.push({ 
                ...disc, 
                reason: 'Loan not found in database - manual intervention required' 
            });
            continue;
        }

        if (disc.type === 'LOAN_NOT_UPDATED') {
            try {
                // Find the corresponding collection
                const cc = collections.find(c => c.loanId === disc.loanId);
                if (!cc) {
                    failed.push({ ...disc, reason: 'Collection not found for repair' });
                    continue;
                }

                // Build the update data from the cash collection
                const updateData = {
                    loanBalance: safeNumber(cc.loanBalance),
                    noOfPayments: cc.noOfPayments === '-' ? 0 : safeNumber(cc.noOfPayments),
                    mcbu: safeNumber(cc.mcbu),
                    lastUpdated: dateAdded,
                    dateModified: dateAdded
                };

                // Include additional fields if they exist in the collection
                if (cc.hasOwnProperty('mcbuCol')) {
                    // We need to be careful here - mcbuCollection is cumulative
                    // For now, we'll set it based on the collection value
                    updateData.mcbuCollection = safeNumber(cc.mcbuCol);
                }

                if (cc.hasOwnProperty('csf')) {
                    updateData.csf = safeNumber(cc.csf);
                }

                if (cc.hasOwnProperty('csfCollection')) {
                    updateData.csfCollection = safeNumber(cc.csfCollection);
                }

                if (cc.status && cc.status !== 'totals') {
                    updateData.status = cc.status;
                }

                if (cc.hasOwnProperty('pastDue')) {
                    updateData.pastDue = safeNumber(cc.pastDue);
                }

                if (cc.hasOwnProperty('amountRelease')) {
                    updateData.amountRelease = safeNumber(cc.amountRelease);
                }

                // Add history entry for audit trail
                updateData.history = cc.history || null;

                // Build the mutation
                const LOAN_UPDATE_TYPE = createGraphType('loans', '_id');
                
                mutationQl.push(
                    updateQl(LOAN_UPDATE_TYPE('repair_loan_' + mutationQl.length), {
                        set: updateData,
                        where: { _id: { _eq: disc.loanId } }
                    })
                );

                repaired.push({
                    loanId: disc.loanId,
                    clientId: disc.clientId,
                    clientName: disc.clientName,
                    slotNo: disc.slotNo,
                    updates: updateData
                });

            } catch (error) {
                failed.push({ 
                    ...disc, 
                    reason: `Error preparing repair: ${error.message}` 
                });
            }
        }
    }

    // Execute all mutations in a single batch
    if (mutationQl.length > 0) {
        try {
            const result = await graph.mutation(...mutationQl);
            
            // Check for GraphQL errors
            if (result.errors && result.errors.length > 0) {
                const errorMsg = result.errors.map(e => e.message).join(', ');
                throw new Error(`GraphQL mutation failed: ${errorMsg}`);
            }
            
            logger.info({
                user_id,
                page: 'Verify Transaction',
                message: 'Repair completed successfully',
                repairedCount: repaired.length,
                failedCount: failed.length
            });
            
        } catch (error) {
            logger.error({
                user_id,
                page: 'Verify Transaction',
                message: 'Repair mutation failed',
                error: error.message
            });
            
            // Move all repaired items to failed since the batch failed
            for (const item of repaired) {
                failed.push({ ...item, reason: `Batch mutation failed: ${error.message}` });
            }
            repaired.length = 0;
        }
    }

    return { 
        repaired, 
        failed,
        totalProcessed: repaired.length + failed.length
    };
}