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
 * 2. mcbu_withdrawals table: mcbu_withdrawal_amount, csf_withdrawal_amount, modified_by, modified_date, editHistory
 * 3. cashCollections table: mcbu, mcbuWithdrawal, csf, csfWithdrawal, modifiedBy, modifiedDateTime
 * 
 * NEW: Enforces "edit once" restriction via editHistory tracking
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

        // Validate that at least one withdrawal amount is being updated
        const isUpdatingMcbu = mcbuWithdrawalAmount !== undefined && mcbuWithdrawalAmount !== null;
        const isUpdatingCsf = csfWithdrawalAmount !== undefined && csfWithdrawalAmount !== null;

        if (!isUpdatingMcbu && !isUpdatingCsf) {
            return res.status(400).json({
                success: false,
                message: 'At least one withdrawal amount (MCBU or CSF) must be provided'
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

        // ========================================================================
        // NEW: Get withdrawal record and check editHistory for edit-once restriction
        // ========================================================================
        const withdrawalId = mcbuWithdrawalId || csfWithdrawalId;
        
        if (!withdrawalId) {
            return res.status(400).json({
                success: false,
                message: 'Withdrawal ID is required'
            });
        }

        // Fetch the withdrawal record to get its editHistory
        const withdrawalResult = await graph.query(
            queryQl(mcbuWithdrawalsType('existing_withdrawal'), {
                where: { _id: { _eq: withdrawalId } }
            })
        );

        const existingWithdrawal = withdrawalResult.data?.existing_withdrawal?.[0];

        if (!existingWithdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal record not found'
            });
        }

        // Get current editHistory
        const currentEditHistory = existingWithdrawal.editHistory || [];

        // ========================================================================
        // Check if MCBU has been edited (if we're updating MCBU)
        // ========================================================================
        if (isUpdatingMcbu) {
            const mcbuEdits = currentEditHistory.filter(entry => {
                const isManagerOrHigher = 
                    entry.modifiedByRole === 'regional_manager' ||
                    entry.modifiedByRole === 'admin' ||
                    entry.modifiedByRole === 'deputy_director';
                
                return entry.action === 'MCBU_WITHDRAWAL_UPDATE' && isManagerOrHigher;
            });

            if (mcbuEdits.length >= 1) {
                const lastEdit = mcbuEdits[mcbuEdits.length - 1];
                
                logger.warn({
                    user_id,
                    page: 'Regional Manager Edit Withdrawal',
                    action: 'EDIT_ONCE_VIOLATION',
                    type: 'MCBU',
                    withdrawalId,
                    message: 'MCBU withdrawal has already been edited once',
                    previousEdit: lastEdit
                });

                return res.status(403).json({
                    success: false,
                    message: 'This MCBU withdrawal has already been edited once by a regional manager. Further edits are not allowed.',
                    previousEdit: {
                        timestamp: lastEdit.timestamp,
                        modifiedBy: lastEdit.modifiedBy,
                        modifiedByRole: lastEdit.modifiedByRole,
                        type: 'MCBU'
                    }
                });
            }
        }

        // ========================================================================
        // Check if CSF has been edited (if we're updating CSF)
        // ========================================================================
        if (isUpdatingCsf) {
            const csfEdits = currentEditHistory.filter(entry => {
                const isManagerOrHigher = 
                    entry.modifiedByRole === 'regional_manager' ||
                    entry.modifiedByRole === 'admin' ||
                    entry.modifiedByRole === 'deputy_director';
                
                return entry.action === 'CSF_WITHDRAWAL_UPDATE' && isManagerOrHigher;
            });

            if (csfEdits.length >= 1) {
                const lastEdit = csfEdits[csfEdits.length - 1];
                
                logger.warn({
                    user_id,
                    page: 'Regional Manager Edit Withdrawal',
                    action: 'EDIT_ONCE_VIOLATION',
                    type: 'CSF',
                    withdrawalId,
                    message: 'CSF withdrawal has already been edited once',
                    previousEdit: lastEdit
                });

                return res.status(403).json({
                    success: false,
                    message: 'This CSF withdrawal has already been edited once by a regional manager. Further edits are not allowed.',
                    previousEdit: {
                        timestamp: lastEdit.timestamp,
                        modifiedBy: lastEdit.modifiedBy,
                        modifiedByRole: lastEdit.modifiedByRole,
                        type: 'CSF'
                    }
                });
            }
        }

        // ========================================================================
        // NEW: Create editHistory entries for this update
        // ========================================================================
        const currentDateTime = new Date().toISOString();
        const newEditHistoryEntries = [];

        // Create MCBU edit entry if updating MCBU
        if (isUpdatingMcbu) {
            newEditHistoryEntries.push({
                action: 'MCBU_WITHDRAWAL_UPDATE',
                timestamp: currentDateTime,
                modifiedBy: modifiedBy,
                modifiedByRole: userRoleShortCode,
                reason: reason || 'Regional Manager MCBU Withdrawal Edit',
                changes: {
                    mcbuWithdrawal: {
                        from: originalMcbuWithdrawal ?? existingWithdrawal.mcbu_withdrawal_amount,
                        to: mcbuWithdrawalAmount
                    },
                    mcbuBalance: {
                        from: currentLoan.mcbu,
                        to: newMcbuBalance
                    }
                }
            });
        }

        // Create CSF edit entry if updating CSF
        if (isUpdatingCsf) {
            newEditHistoryEntries.push({
                action: 'CSF_WITHDRAWAL_UPDATE',
                timestamp: currentDateTime,
                modifiedBy: modifiedBy,
                modifiedByRole: userRoleShortCode,
                reason: reason || 'Regional Manager CSF Withdrawal Edit',
                changes: {
                    csfWithdrawal: {
                        from: originalCsfWithdrawal ?? existingWithdrawal.csf_withdrawal_amount,
                        to: csfWithdrawalAmount
                    },
                    csfBalance: {
                        from: currentLoan.csf,
                        to: newCsfBalance
                    }
                }
            });
        }

        // Append new entries to existing editHistory
        const updatedEditHistory = [...currentEditHistory, ...newEditHistoryEntries];

        // ========================================================================
        // Build mutation list
        // ========================================================================
        const mutationList = [];

        // 1. Update the loan record - using exact field names from LOAN_FIELDS
        // Fields: mcbu, mcbuWithdrawal, csf, csfWithdrawal, modifiedBy, modifiedDateTime
        const loanUpdateData = {
            modifiedBy: modifiedBy,
            modifiedDateTime: currentDateTime
        };

        if (isUpdatingMcbu) {
            loanUpdateData.mcbu = newMcbuBalance;
            loanUpdateData.mcbuWithdrawal = mcbuWithdrawalAmount;
        }

        if (isUpdatingCsf && isGroupLeader) {
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
        // Fields: mcbu_withdrawal_amount, csf_withdrawal_amount, modified_by, modified_date, editHistory
        const withdrawalUpdateData = {
            modified_by: modifiedBy,
            modified_date: currentDateTime,
            editHistory: updatedEditHistory  // ← NEW: Include editHistory
        };

        if (isUpdatingMcbu) {
            withdrawalUpdateData.mcbu_withdrawal_amount = mcbuWithdrawalAmount;
        }

        if (isUpdatingCsf && isGroupLeader) {
            withdrawalUpdateData.csf_withdrawal_amount = csfWithdrawalAmount;
        }

        mutationList.push(
            updateQl(mcbuWithdrawalsType('update_withdrawal'), {
                set: filterGraphFields(MCBU_WITHDRAWAL_FIELDS, withdrawalUpdateData),
                where: { _id: { _eq: withdrawalId } }
            })
        );

        // 3. Update the cash collection record - using exact field names from CASH_COLLECTIONS_FIELDS
        // Fields: mcbu, mcbuWithdrawal, csf, csfWithdrawal, modifiedBy, modifiedDateTime
        if (cashCollectionId) {
            const ccUpdateData = {
                modifiedBy: modifiedBy,
                modifiedDateTime: currentDateTime
            };

            if (isUpdatingMcbu) {
                ccUpdateData.mcbu = newMcbuBalance;
                ccUpdateData.mcbuWithdrawal = mcbuWithdrawalAmount;
            }

            if (isUpdatingCsf && isGroupLeader) {
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
            editTypes: {
                mcbu: isUpdatingMcbu,
                csf: isUpdatingCsf
            },
            previousValues: {
                mcbuWithdrawal: originalMcbuWithdrawal ?? existingWithdrawal.mcbu_withdrawal_amount,
                csfWithdrawal: originalCsfWithdrawal ?? existingWithdrawal.csf_withdrawal_amount,
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
            branchId,
            editHistoryLength: updatedEditHistory.length
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
            newCsfWithdrawal: csfWithdrawalAmount,
            editCount: updatedEditHistory.length
        });

        return res.status(200).json({
            success: true,
            message: 'Withdrawal amounts updated successfully',
            data: {
                loanId: loanId,
                newMcbuWithdrawal: mcbuWithdrawalAmount,
                newCsfWithdrawal: csfWithdrawalAmount,
                newMcbuBalance: newMcbuBalance,
                newCsfBalance: newCsfBalance,
                editHistory: updatedEditHistory
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