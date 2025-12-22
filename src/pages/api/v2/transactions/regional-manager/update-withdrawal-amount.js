import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { LOAN_FIELDS, CASH_COLLECTIONS_FIELDS, MCBU_WITHDRAWAL_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { filterGraphFields } from '@/lib/graph.functions';
import logger from '@/logger';

const graph = new GraphProvider();

// Type definitions using actual FIELDS from graph.fields.js
const loansType = (alias) => createGraphType('loans', LOAN_FIELDS)(alias ?? 'loans');
const cashCollectionsType = (alias) => createGraphType('cashCollections', CASH_COLLECTIONS_FIELDS)(alias ?? 'cashCollections');
const mcbuWithdrawalsType = (alias) => createGraphType('mcbu_withdrawals', MCBU_WITHDRAWAL_FIELDS)(alias ?? 'mcbu_withdrawals');
const usersType = (alias) => createGraphType('users', USER_FIELDS)(alias ?? 'users');

export default apiHandler({
    post: updateWithdrawalAmount
});

/**
 * API endpoint for regional managers to update MCBU/CSF withdrawal amounts
 * 
 * Updates:
 * 1. loans table: mcbu, mcbuWithdrawal, csf, csfWithdrawal, modifiedBy, modifiedDateTime
 * 2. mcbu_withdrawals table: mcbu_withdrawal_amount, csf_withdrawal_amount, modified_by, modified_date
 * 3. cashCollections table: mcbu, mcbuWithdrawal, csf, csfWithdrawal, modifiedBy, modifiedDateTime
 */
async function updateWithdrawalAmount(req, res) {
    const user_id = req?.auth?.sub;

    try {
        const {
            loanId,
            cashCollectionId,
            clientId,
            mcbuWithdrawalId,
            csfWithdrawalId,
            mcbuWithdrawalAmount,
            csfWithdrawalAmount,
            originalMcbuWithdrawal,
            originalCsfWithdrawal,
            newMcbuBalance,
            newCsfBalance,
            modifiedBy,
            modifiedDate,
            modifiedByRole,
            reason,
            isGroupLeader,
            groupId,
            branchId
        } = req.body;

        logger.debug({
            user_id,
            page: 'Regional Manager Edit Withdrawal',
            message: 'Update Withdrawal Amount Request',
            loanId,
            mcbuWithdrawalAmount,
            csfWithdrawalAmount
        });

        // Validate required fields
        if (!loanId || !clientId || !modifiedBy) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: loanId, clientId, and modifiedBy are required'
            });
        }

        // Validate that the modifier is a regional manager or admin
        const modifierResult = await graph.query(
            queryQl(usersType(), {
                where: { _id: { _eq: modifiedBy } }
            })
        );
        
        const modifier = modifierResult.data?.users?.[0];

        if (!modifier) {
            return res.status(403).json({
                success: false,
                message: 'Invalid modifier user'
            });
        }

        // Role is stored as JSONB - may be string or object
        let userRole = modifier.role;
        if (typeof userRole === 'string') {
            try {
                userRole = JSON.parse(userRole);
            } catch (e) {
                userRole = {};
            }
        }
        const userRoleShortCode = userRole?.shortCode || modifiedByRole;

        const allowedRoles = ['regional_manager', 'admin', 'deputy_director'];
        if (!allowedRoles.includes(userRoleShortCode)) {
            logger.warn({
                user_id,
                page: 'Regional Manager Edit Withdrawal',
                message: 'Unauthorized role attempted to edit withdrawal',
                role: userRoleShortCode
            });
            return res.status(403).json({
                success: false,
                message: 'Only regional managers and admins can perform this action'
            });
        }

        // Get the current loan data
        const loanResult = await graph.query(
            queryQl(loansType(), {
                where: { _id: { _eq: loanId } }
            })
        );
        
        const currentLoan = loanResult.data?.loans?.[0];

        if (!currentLoan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Build mutation list
        const mutationList = [];
        const withdrawalId = mcbuWithdrawalId || csfWithdrawalId;
        const currentDateTime = new Date().toISOString();

        // 1. Update the loan record - using exact field names from LOAN_FIELDS
        // Fields: mcbu, mcbuWithdrawal, csf, csfWithdrawal, modifiedBy, modifiedDateTime
        const loanUpdateData = {
            mcbu: newMcbuBalance,
            mcbuWithdrawal: mcbuWithdrawalAmount,
            modifiedBy: modifiedBy,
            modifiedDateTime: currentDateTime
        };

        if (isGroupLeader) {
            loanUpdateData.csf = newCsfBalance;
            loanUpdateData.csfWithdrawal = csfWithdrawalAmount;
        }

        mutationList.push(
            updateQl(loansType('update_loan'), {
                set: filterGraphFields(LOAN_FIELDS, loanUpdateData),
                where: { _id: { _eq: loanId } }
            })
        );

        // 2. Update the mcbu_withdrawals record - using exact field names from MCBU_WITHDRAWAL_FIELDS
        // Fields: mcbu_withdrawal_amount, csf_withdrawal_amount, modified_by, modified_date
        if (withdrawalId) {
            const withdrawalUpdateData = {
                mcbu_withdrawal_amount: mcbuWithdrawalAmount,
                modified_by: modifiedBy,
                modified_date: currentDateTime
            };

            if (isGroupLeader) {
                withdrawalUpdateData.csf_withdrawal_amount = csfWithdrawalAmount;
            }

            mutationList.push(
                updateQl(mcbuWithdrawalsType('update_withdrawal'), {
                    set: filterGraphFields(MCBU_WITHDRAWAL_FIELDS, withdrawalUpdateData),
                    where: { _id: { _eq: withdrawalId } }
                })
            );
        }

        // 3. Update the cash collection record - using exact field names from CASH_COLLECTIONS_FIELDS
        // Fields: mcbu, mcbuWithdrawal, csf, csfWithdrawal, modifiedBy, modifiedDateTime
        if (cashCollectionId) {
            const ccUpdateData = {
                mcbu: newMcbuBalance,
                mcbuWithdrawal: mcbuWithdrawalAmount,
                modifiedBy: modifiedBy,
                modifiedDateTime: currentDateTime
            };

            if (isGroupLeader) {
                ccUpdateData.csf = newCsfBalance;
                ccUpdateData.csfWithdrawal = csfWithdrawalAmount;
            }

            mutationList.push(
                updateQl(cashCollectionsType('update_cc'), {
                    set: filterGraphFields(CASH_COLLECTIONS_FIELDS, ccUpdateData),
                    where: { _id: { _eq: cashCollectionId } }
                })
            );
        }

        // Log the audit trail
        logger.info({
            user_id,
            page: 'Regional Manager Edit Withdrawal',
            action: 'WITHDRAWAL_AMOUNT_UPDATE',
            loanId,
            clientId,
            cashCollectionId,
            withdrawalId,
            previousValues: {
                mcbuWithdrawal: originalMcbuWithdrawal,
                csfWithdrawal: originalCsfWithdrawal,
                mcbu: currentLoan.mcbu,
                csf: currentLoan.csf
            },
            newValues: {
                mcbuWithdrawal: mcbuWithdrawalAmount,
                csfWithdrawal: csfWithdrawalAmount,
                mcbu: newMcbuBalance,
                csf: newCsfBalance
            },
            modifiedBy,
            modifiedByName: `${modifier.firstName || ''} ${modifier.lastName || ''}`.trim(),
            modifiedByRole: userRoleShortCode,
            reason,
            isGroupLeader,
            groupId,
            branchId
        });

        // Execute all mutations
        const result = await graph.mutation(...mutationList);

        if (result.errors && result.errors.length > 0) {
            logger.error({
                user_id,
                page: 'Regional Manager Edit Withdrawal',
                message: 'GraphQL mutation errors',
                errors: result.errors
            });
            return res.status(400).json({
                success: false,
                message: result.errors[0].message,
                errors: result.errors
            });
        }

        logger.info({
            user_id,
            page: 'Regional Manager Edit Withdrawal',
            message: 'Withdrawal amounts updated successfully',
            loanId,
            newMcbuWithdrawal: mcbuWithdrawalAmount,
            newCsfWithdrawal: csfWithdrawalAmount
        });

        return res.status(200).json({
            success: true,
            message: 'Withdrawal amounts updated successfully',
            data: {
                loanId: loanId,
                newMcbuWithdrawal: mcbuWithdrawalAmount,
                newCsfWithdrawal: csfWithdrawalAmount,
                newMcbuBalance: newMcbuBalance,
                newCsfBalance: newCsfBalance
            }
        });

    } catch (error) {
        logger.error({
            user_id,
            page: 'Regional Manager Edit Withdrawal',
            message: 'Error updating withdrawal amounts',
            error: error.message,
            stack: error.stack
        });
        
        console.error('Error updating withdrawal amounts:', error);
        
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the withdrawal amounts',
            error: error.message
        });
    }
}