import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import Modal from '@/lib/ui/Modal';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { formatPricePhp, safeNumber } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/constants';
import Spinner from '@/components/Spinner';

/**
 * EditMcbuCsfWithdrawalModal
 * 
 * This modal allows regional managers to edit MCBU and CSF withdrawal amounts
 * for clients who have pending or approved withdrawals.
 * 
 * Uses the existing API: /api/v2/transactions/mcbu-withdrawal/update
 * 
 * @param {boolean} show - Whether to show the modal
 * @param {function} onClose - Callback when modal is closed
 * @param {object} cashCollection - The cash collection data containing withdrawal info
 * @param {string} withdrawalType - 'mcbu' or 'csf' or 'both'
 * @param {function} onSuccess - Callback when edit is successful
 */
const EditMcbuCsfWithdrawalModal = ({ 
    show, 
    onClose, 
    cashCollection,
    withdrawalType = 'mcbu', 
    onSuccess 
}) => {
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    const [loading, setLoading] = useState(false);
    const [mcbuWithdrawalAmount, setMcbuWithdrawalAmount] = useState(0);
    const [csfWithdrawalAmount, setCsfWithdrawalAmount] = useState(0);
    const [originalMcbuWithdrawal, setOriginalMcbuWithdrawal] = useState(0);
    const [originalCsfWithdrawal, setOriginalCsfWithdrawal] = useState(0);
    const [mcbuBalance, setMcbuBalance] = useState(0);
    const [csfBalance, setCsfBalance] = useState(0);
    const [isGroupLeader, setIsGroupLeader] = useState(false);

    // Use cashCollection as the data source
    const withdrawalData = cashCollection;

    useEffect(() => {
        if (withdrawalData && show) {
            // Set current withdrawal amounts
            const mcbuWd = safeNumber(withdrawalData.mcbuWithdrawal);
            const csfWd = safeNumber(withdrawalData.csfWithdrawal);
            
            setMcbuWithdrawalAmount(mcbuWd);
            setCsfWithdrawalAmount(csfWd);
            setOriginalMcbuWithdrawal(mcbuWd);
            setOriginalCsfWithdrawal(csfWd);
            
            // Current balance from DB (this is the actual current balance)
            // The withdrawal has already been approved and applied
            const mcbuBal = safeNumber(withdrawalData.mcbu);
            const csfBal = safeNumber(withdrawalData.csf);
            
            setMcbuBalance(mcbuBal);
            setCsfBalance(csfBal);
            
            // Check if group leader
            setIsGroupLeader(withdrawalData.groupLeader || withdrawalData.client?.groupLeader || false);
        }
    }, [withdrawalData, show]);

    const calculateMaxMcbuWithdrawal = () => {
        // Original balance = current balance + current withdrawal
        const originalBalance = mcbuBalance + originalMcbuWithdrawal;
        if (!originalBalance) return 0;
        
        // For group leaders: can withdraw excess over ₱3,000
        // For regular clients: can withdraw excess over ₱1,000
        const minBalance = isGroupLeader ? 3000 : 1000;
        const maxWithdrawal = Math.max(0, originalBalance - minBalance);
        
        return maxWithdrawal;
    };

    const calculateMaxCsfWithdrawal = () => {
        if (!isGroupLeader) return 0;
        // Original balance = current balance + current withdrawal
        const originalBalance = csfBalance + originalCsfWithdrawal;
        return originalBalance;
    };

    const handleMcbuChange = (e) => {
        const value = e.target.value ? parseInt(e.target.value) : 0;
        const maxWithdrawal = calculateMaxMcbuWithdrawal();
        
        if (value > maxWithdrawal) {
            toast.warning(`Maximum MCBU withdrawal is ${formatPricePhp(maxWithdrawal)}`);
            setMcbuWithdrawalAmount(maxWithdrawal);
        } else if (value < 0) {
            setMcbuWithdrawalAmount(0);
        } else {
            setMcbuWithdrawalAmount(value);
        }
    };

    const handleCsfChange = (e) => {
        const value = e.target.value ? parseInt(e.target.value) : 0;
        const maxWithdrawal = calculateMaxCsfWithdrawal();
        
        if (value > maxWithdrawal) {
            toast.warning(`Maximum CSF withdrawal is ${formatPricePhp(maxWithdrawal)}`);
            setCsfWithdrawalAmount(maxWithdrawal);
        } else if (value < 0) {
            setCsfWithdrawalAmount(0);
        } else {
            setCsfWithdrawalAmount(value);
        }
    };

    const hasChanges = () => {
        // Check changes based on withdrawalType
        if (withdrawalType === 'mcbu') {
            return mcbuWithdrawalAmount !== originalMcbuWithdrawal;
        } else if (withdrawalType === 'csf') {
            return csfWithdrawalAmount !== originalCsfWithdrawal;
        } else {
            // 'both' - either can change
            return mcbuWithdrawalAmount !== originalMcbuWithdrawal || 
                   csfWithdrawalAmount !== originalCsfWithdrawal;
        }
    };

    const handleSubmit = async () => {
        if (!hasChanges()) {
            toast.info('No changes detected');
            onClose();
            return;
        }

        // Get the withdrawal ID - it could be mcbuWithdrawalId or the record ID
        const withdrawalId = withdrawalData.mcbuWithdrawalId || withdrawalData.withdrawalId;
        
        if (!withdrawalId) {
            toast.error('Withdrawal ID not found');
            return;
        }

        setLoading(true);

        try {
            // Determine what changed based on withdrawalType
            const mcbuChanged = (withdrawalType === 'mcbu' || withdrawalType === 'both') && mcbuWithdrawalAmount !== originalMcbuWithdrawal;
            const csfChanged = (withdrawalType === 'csf' || withdrawalType === 'both') && csfWithdrawalAmount !== originalCsfWithdrawal;

            // Build payload with all required fields
            const payload = {
                // Required fields
                loanId: withdrawalData.loanId,
                clientId: withdrawalData.clientId,
                modifiedBy: currentUser._id,
                
                // Withdrawal record IDs
                cashCollectionId: withdrawalData._id,
                mcbuWithdrawalId: withdrawalId,
                csfWithdrawalId: withdrawalId,
                
                // Original values for audit
                originalMcbuWithdrawal: originalMcbuWithdrawal,
                originalCsfWithdrawal: originalCsfWithdrawal,
                
                // Metadata
                modifiedDate: currentDate,
                modifiedByRole: currentUser.role?.shortCode,
                reason: `Regional Manager Edit - ${withdrawalType.toUpperCase()} Withdrawal Update`,
                
                // Additional context
                isGroupLeader: isGroupLeader,
                groupId: withdrawalData.groupId,
                branchId: withdrawalData.branchId
            };

            // Set withdrawal amounts and calculate new balances
            // mcbuBalance/csfBalance = current balance (AFTER withdrawal was applied)
            // originalWithdrawal = the withdrawal amount that was already deducted
            // newBalance = currentBalance + (originalWithdrawal - newWithdrawalAmount)
            //            = currentBalance + amountReturned
            if (mcbuChanged) {
                payload.mcbuWithdrawalAmount = mcbuWithdrawalAmount;
                // New balance = current + (original - new) = current + amount returned
                payload.newMcbuBalance = mcbuBalance + (originalMcbuWithdrawal - mcbuWithdrawalAmount);
            } else {
                payload.mcbuWithdrawalAmount = originalMcbuWithdrawal;
                payload.newMcbuBalance = mcbuBalance; // No change
            }

            if (csfChanged && isGroupLeader) {
                payload.csfWithdrawalAmount = csfWithdrawalAmount;
                // New balance = current + (original - new) = current + amount returned
                payload.newCsfBalance = csfBalance + (originalCsfWithdrawal - csfWithdrawalAmount);
            } else {
                payload.csfWithdrawalAmount = originalCsfWithdrawal;
                payload.newCsfBalance = csfBalance; // No change
            }

            console.log('Updating withdrawal with payload:', payload);

            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/regional-manager/update-withdrawal-amount',
                payload
            );

            if (response.success) {
                const updatedType = withdrawalType === 'mcbu' ? 'MCBU' : withdrawalType === 'csf' ? 'CSF' : 'Withdrawal';
                toast.success(`${updatedType} withdrawal amount updated successfully`);
                onSuccess && onSuccess();
                onClose();
            } else {
                toast.error(response.message || 'Failed to update withdrawal amount');
            }
        } catch (error) {
            console.error('Error updating withdrawal amount:', error);
            toast.error('An error occurred while updating the withdrawal amount');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setMcbuWithdrawalAmount(originalMcbuWithdrawal);
        setCsfWithdrawalAmount(originalCsfWithdrawal);
        onClose();
    };

    if (!withdrawalData) return null;

    const maxMcbuWithdrawal = calculateMaxMcbuWithdrawal();
    const maxCsfWithdrawal = calculateMaxCsfWithdrawal();

    // Determine modal title based on withdrawal type
    const getModalTitle = () => {
        if (withdrawalType === 'mcbu') return 'Edit MCBU Withdrawal';
        if (withdrawalType === 'csf') return 'Edit CSF Withdrawal';
        return 'Edit Withdrawal Amount';
    };

    return (
        <Modal 
            title={getModalTitle()} 
            show={show} 
            onClose={handleCancel}
            width="40rem"
        >
            {loading ? (
                <div className="flex justify-center items-center py-10">
                    <Spinner />
                </div>
            ) : (
                <div className="p-6">
                    {/* Client Info */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-proxima-bold text-sm text-gray-500 mb-2">Client Information</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-gray-500">Name:</span>
                                <span className="ml-2 font-medium">{withdrawalData.fullName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Slot #:</span>
                                <span className="ml-2 font-medium">{withdrawalData.slotNo}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Group Leader:</span>
                                <span className="ml-2 font-medium">{isGroupLeader ? 'Yes' : 'No'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Status:</span>
                                <span className="ml-2 font-medium capitalize">{withdrawalData.status}</span>
                            </div>
                        </div>
                    </div>

                    {/* Current Balances */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-proxima-bold text-sm text-blue-600 mb-2">Current Balances</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {(withdrawalType === 'mcbu' || withdrawalType === 'both') && (
                                <div className="p-3 bg-white rounded-lg">
                                    <span className="text-gray-500 block">MCBU Balance:</span>
                                    <span className="text-xl font-bold text-main">{formatPricePhp(mcbuBalance)}</span>
                                    <span className="text-xs text-gray-400 block mt-1">
                                        Max withdrawal: {formatPricePhp(maxMcbuWithdrawal)}
                                    </span>
                                </div>
                            )}
                            {(withdrawalType === 'csf' || withdrawalType === 'both') && isGroupLeader && (
                                <div className="p-3 bg-white rounded-lg">
                                    <span className="text-gray-500 block">CSF Balance:</span>
                                    <span className="text-xl font-bold text-main">{formatPricePhp(csfBalance)}</span>
                                    <span className="text-xs text-gray-400 block mt-1">
                                        Max withdrawal: {formatPricePhp(maxCsfWithdrawal)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Original Withdrawal Values */}
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                        <h3 className="font-proxima-bold text-sm text-yellow-600 mb-2">Current Withdrawal Amounts</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {(withdrawalType === 'mcbu' || withdrawalType === 'both') && (
                                <div>
                                    <span className="text-gray-500">MCBU Withdrawal:</span>
                                    <span className="ml-2 font-medium">{formatPricePhp(originalMcbuWithdrawal)}</span>
                                </div>
                            )}
                            {(withdrawalType === 'csf' || withdrawalType === 'both') && isGroupLeader && (
                                <div>
                                    <span className="text-gray-500">CSF Withdrawal:</span>
                                    <span className="ml-2 font-medium">{formatPricePhp(originalCsfWithdrawal)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Edit Section */}
                    <div className="mb-6 space-y-4">
                        {/* MCBU Withdrawal Input */}
                        {(withdrawalType === 'mcbu' || withdrawalType === 'both') && (
                            <div>
                                <label className="block text-sm font-proxima-bold text-gray-700 mb-2">
                                    New MCBU Withdrawal Amount
                                </label>
                                <input
                                    type="number"
                                    value={mcbuWithdrawalAmount}
                                    onChange={handleMcbuChange}
                                    min={0}
                                    max={maxMcbuWithdrawal}
                                    step={10}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-main focus:border-main"
                                    placeholder="Enter MCBU withdrawal amount"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum allowed: {formatPricePhp(maxMcbuWithdrawal)} 
                                    (Minimum {isGroupLeader ? '₱3,000' : '₱1,000'} must remain)
                                </p>
                            </div>
                        )}

                        {/* CSF Withdrawal Input - Only for group leaders */}
                        {(withdrawalType === 'csf' || withdrawalType === 'both') && isGroupLeader && (
                            <div>
                                <label className="block text-sm font-proxima-bold text-gray-700 mb-2">
                                    New CSF Withdrawal Amount
                                </label>
                                <input
                                    type="number"
                                    value={csfWithdrawalAmount}
                                    onChange={handleCsfChange}
                                    min={0}
                                    max={maxCsfWithdrawal}
                                    step={10}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-main focus:border-main"
                                    placeholder="Enter CSF withdrawal amount"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum allowed: {formatPricePhp(maxCsfWithdrawal)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Preview of Changes */}
                    {hasChanges() && (
                        <div className="mb-6 p-4 bg-green-50 rounded-lg">
                            <h3 className="font-proxima-bold text-sm text-green-600 mb-2">Preview After Update</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {/* Only show MCBU preview if MCBU is being edited */}
                                {(withdrawalType === 'mcbu' || withdrawalType === 'both') && mcbuWithdrawalAmount !== originalMcbuWithdrawal && (
                                    <div>
                                        <span className="text-gray-500">New MCBU Balance:</span>
                                        <span className="ml-2 font-medium text-green-600">
                                            {formatPricePhp(mcbuBalance + (originalMcbuWithdrawal - mcbuWithdrawalAmount))}
                                        </span>
                                    </div>
                                )}
                                {/* Only show CSF preview if CSF is being edited */}
                                {(withdrawalType === 'csf' || withdrawalType === 'both') && isGroupLeader && csfWithdrawalAmount !== originalCsfWithdrawal && (
                                    <div>
                                        <span className="text-gray-500">New CSF Balance:</span>
                                        <span className="ml-2 font-medium text-green-600">
                                            {formatPricePhp(csfBalance + (originalCsfWithdrawal - csfWithdrawalAmount))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-700">
                            <strong>Warning:</strong> This action will update the withdrawal records. 
                            This change will be logged for audit purposes.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                        <ButtonOutline 
                            label="Cancel" 
                            onClick={handleCancel}
                            className="px-6"
                        />
                        <ButtonSolid 
                            label="Update Withdrawal" 
                            onClick={handleSubmit}
                            disabled={!hasChanges()}
                            className="px-6"
                        />
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default EditMcbuCsfWithdrawalModal;