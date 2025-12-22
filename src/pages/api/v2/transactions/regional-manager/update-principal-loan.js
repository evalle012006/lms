import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl, queryQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';
import logger from '@/logger';

const graph = new GraphProvider();

// Graph types
const loansType = createGraphType('loans', '_id');
const cashCollectionsType = createGraphType('cashCollections', '_id');

export default apiHandler({
    post: updatePrincipalLoan
});

/**
 * API to update principal loan amount for Regional Managers
 * 
 * This updates:
 * 1. The loan record (principalLoan, amountRelease, activeLoan, loanBalance, targetCollection)
 * 2. The cash collection record (currentReleaseAmount if applicable)
 * 3. Logs the change using the application logger
 */
async function updatePrincipalLoan(req, res) {
    const {
        loanId,
        cashCollectionId,
        principalLoan,
        amountRelease,
        activeLoan,
        loanBalance,
        targetCollection,
        serviceChargeRate,
        loanTerms,
        modifiedBy,
        modifiedDate,
        modifiedByRole,
        originalPrincipalLoan,
        originalAmountRelease,
        reason,
        clientId,
        groupId,
        branchId
    } = req.body;

    // Get user from auth
    const userId = req?.auth?.sub || modifiedBy;

    // Log the incoming request
    logger.info({
        page: 'update-principal-loan',
        action: 'REQUEST',
        user_id: userId,
        loanId,
        originalPrincipalLoan,
        newPrincipalLoan: principalLoan,
        originalAmountRelease,
        newAmountRelease: amountRelease
    });

    // Validation
    if (!loanId) {
        logger.warn({
            page: 'update-principal-loan',
            action: 'VALIDATION_ERROR',
            message: 'Loan ID is required'
        });
        return res.status(400).json({
            success: false,
            message: 'Loan ID is required'
        });
    }

    if (!principalLoan || principalLoan <= 0) {
        logger.warn({
            page: 'update-principal-loan',
            action: 'VALIDATION_ERROR',
            message: 'Valid principal loan amount is required'
        });
        return res.status(400).json({
            success: false,
            message: 'Valid principal loan amount is required'
        });
    }

    if (principalLoan % 1000 !== 0) {
        logger.warn({
            page: 'update-principal-loan',
            action: 'VALIDATION_ERROR',
            message: 'Principal loan must be divisible by 1000'
        });
        return res.status(400).json({
            success: false,
            message: 'Principal loan must be divisible by 1000'
        });
    }

    try {
        const currentDate = getCurrentDate();
        const currentDateTime = moment().toISOString();

        // First, verify the loan exists and get current data
        const existingLoanResult = await graph.query(
            queryQl(loansType('existing_loan'), {
                where: { _id: { _eq: loanId } },
                limit: 1
            })
        );

        const existingLoan = existingLoanResult?.data?.existing_loan?.[0];
        
        if (!existingLoan) {
            logger.warn({
                page: 'update-principal-loan',
                action: 'NOT_FOUND',
                loanId,
                message: 'Loan not found'
            });
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Create audit log entry (stored in logger, not in DB table)
        const auditInfo = {
            action: 'PRINCIPAL_LOAN_UPDATE',
            timestamp: currentDateTime,
            modifiedBy: userId,
            modifiedByRole: modifiedByRole,
            reason: reason || 'Regional Manager Edit',
            loanId,
            clientId,
            groupId,
            branchId,
            changes: {
                principalLoan: {
                    from: originalPrincipalLoan || existingLoan.principalLoan,
                    to: principalLoan
                },
                amountRelease: {
                    from: originalAmountRelease || existingLoan.amountRelease,
                    to: amountRelease
                },
                activeLoan: {
                    from: existingLoan.activeLoan,
                    to: activeLoan
                },
                loanBalance: {
                    from: existingLoan.loanBalance,
                    to: loanBalance
                }
            }
        };

        // Log audit info
        logger.info({
            page: 'update-principal-loan',
            action: 'AUDIT_TRAIL',
            user_id: userId,
            ...auditInfo
        });

        // Build mutations array
        const mutations = [];

        // 1. Update the loan record
        const loanUpdateData = {
            principalLoan: principalLoan,
            amountRelease: amountRelease,
            activeLoan: activeLoan,
            loanBalance: loanBalance,
            targetCollection: targetCollection || activeLoan,
            dateModified: currentDateTime,
            modifiedBy: userId
        };

        mutations.push(
            updateQl(loansType('update_loan'), {
                where: { _id: { _eq: loanId } },
                set: loanUpdateData
            })
        );

        // 2. Update cash collection if ID provided (update currentReleaseAmount)
        if (cashCollectionId) {
            mutations.push(
                updateQl(cashCollectionsType('update_cc'), {
                    where: { _id: { _eq: cashCollectionId } },
                    set: {
                        currentReleaseAmount: amountRelease,
                        dateModified: currentDateTime,
                        modifiedBy: userId
                    }
                })
            );
        }

        // 3. Also update any cash collections that reference this loan
        mutations.push(
            updateQl(cashCollectionsType('update_cc_by_loan'), {
                where: { 
                    loanId: { _eq: loanId },
                    dateAdded: { _eq: currentDate }
                },
                set: {
                    currentReleaseAmount: amountRelease,
                    targetCollection: activeLoan,
                    dateModified: currentDateTime,
                    modifiedBy: userId
                }
            })
        );

        // Execute all mutations
        const result = await graph.mutation(...mutations);

        // Check for errors
        if (result.errors && result.errors.length > 0) {
            logger.error({
                page: 'update-principal-loan',
                action: 'MUTATION_ERROR',
                user_id: userId,
                loanId,
                errors: result.errors
            });
            return res.status(400).json({
                success: false,
                message: result.errors[0].message,
                error: result.errors[0].message
            });
        }

        // Log success
        logger.info({
            page: 'update-principal-loan',
            action: 'SUCCESS',
            user_id: userId,
            loanId,
            clientId,
            groupId,
            branchId,
            changes: auditInfo.changes
        });

        return res.status(200).json({
            success: true,
            message: 'Principal loan updated successfully',
            data: {
                loanId,
                principalLoan,
                amountRelease,
                activeLoan,
                loanBalance,
                updatedAt: currentDateTime
            }
        });

    } catch (error) {
        logger.error({
            page: 'update-principal-loan',
            action: 'ERROR',
            user_id: userId,
            loanId,
            error: error.message,
            stack: error.stack
        });

        console.error('Error updating principal loan:', error);
        
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the principal loan',
            error: error.message
        });
    }
}