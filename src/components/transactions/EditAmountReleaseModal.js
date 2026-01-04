import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Modal from '@/lib/ui/Modal';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { formatPricePhp, safeNumber } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';

/**
 * Modal for Regional Managers to edit Principal Loan Amount
 * 
 * This modal handles the case where:
 * - For RELOANERS: cc.loanId points to the NEW pending loan
 * - cc.currentReleaseAmount contains the amountRelease of the new loan
 * - We derive principalLoan from currentReleaseAmount / serviceChargeRate
 * 
 * Props:
 * - show: boolean - Controls modal visibility
 * - onClose: function - Called when modal is closed
 * - onSuccess: function - Called after successful update
 * - cashCollection: object - The cash collection record (cc from the table)
 * - currentUser: object - The current logged-in user
 */
const EditAmountReleaseModal = ({
    show,
    onClose,
    onSuccess,
    cashCollection,
    currentUser
}) => {
    // Get transaction settings from Redux store
    const transactionSettings = useSelector(state => state.transactionSettings?.data || state.transactionsSettings?.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    // Get service charge rate from settings (default to 1.2 if not available)
    const serviceChargeRate = safeNumber(transactionSettings?.serviceChargeRate) || 1.2;

    // Extract values from cashCollection (cc)
    // For reloaners, cc.currentReleaseAmount is the new loan's amountRelease
    // cc.loanId points to the NEW pending loan
    const currentReleaseAmount = safeNumber(cashCollection?.currentReleaseAmount || 0);
    const loanTerms = safeNumber(cashCollection?.loanTerms || 60);
    const occurence = cashCollection?.occurence || cashCollection?.group?.occurence || 'daily';

    // Derive original principal loan from currentReleaseAmount
    // Formula: principalLoan = amountRelease / serviceChargeRate
    // Example: 9600 / 1.2 = 8000
    const derivedPrincipalLoan = currentReleaseAmount > 0 
        ? Math.round(currentReleaseAmount / serviceChargeRate) 
        : 0;

    // State for form
    const [principalLoan, setPrincipalLoan] = useState(derivedPrincipalLoan);
    const [loading, setLoading] = useState(false);

    // Calculated values based on new principal loan
    const calculatedAmountRelease = Math.round(principalLoan * serviceChargeRate);
    const calculatedActiveLoan = Math.round(calculatedAmountRelease / loanTerms);
    const calculatedLoanBalance = calculatedAmountRelease;

    // Reset form when modal opens or derivedPrincipalLoan changes
    useEffect(() => {
        if (show) {
            setPrincipalLoan(derivedPrincipalLoan);
        }
    }, [show, derivedPrincipalLoan]);

    // Validation
    const isValid = principalLoan > 0 && principalLoan % 1000 === 0;
    const hasChanges = principalLoan !== derivedPrincipalLoan;

    // Handle principal loan change
    const handlePrincipalLoanChange = (e) => {
        const value = parseInt(e.target.value) || 0;
        setPrincipalLoan(value);
    };

    // Handle form submission
    const handleSubmit = async () => {
        if (!isValid) {
            toast.error('Principal loan must be greater than 0 and divisible by 1000');
            return;
        }

        if (!hasChanges) {
            toast.info('No changes to save');
            return;
        }

        // Get the loan ID - for reloaners, cc.loanId points to the NEW pending loan
        const loanId = cashCollection?.loanId;
        if (!loanId) {
            toast.error('Unable to determine loan ID');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                loanId: loanId,
                cashCollectionId: cashCollection?._id,
                principalLoan: principalLoan,
                amountRelease: calculatedAmountRelease,
                activeLoan: calculatedActiveLoan,
                loanBalance: calculatedLoanBalance,
                targetCollection: calculatedActiveLoan,
                serviceChargeRate: serviceChargeRate,
                loanTerms: loanTerms,
                modifiedBy: currentUser._id,
                modifiedDate: currentDate,
                modifiedByRole: currentUser.role?.shortCode,
                originalPrincipalLoan: derivedPrincipalLoan,
                originalAmountRelease: currentReleaseAmount,
                reason: 'Regional Manager Edit - Principal Loan Update',
                // Include additional context for the API
                clientId: cashCollection?.clientId,
                groupId: cashCollection?.groupId,
                branchId: cashCollection?.branchId
            };

            console.log('Submitting principal loan update:', payload);

            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/regional-manager/update-principal-loan',
                payload
            );

            if (response.success) {
                toast.success('Principal loan updated successfully');
                onSuccess && onSuccess();
                onClose();
            } else {
                toast.error(response.message || 'Failed to update principal loan');
            }
        } catch (error) {
            console.error('Error updating principal loan:', error);
            toast.error('An error occurred while updating the principal loan');
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    // Get display values from cashCollection
    const clientName = cashCollection?.fullName || '-';
    const slotNo = cashCollection?.slotNo || '-';
    const loanCycle = cashCollection?.loanCycle || '-';
    const status = cashCollection?.status || '-';

    // Check if we have valid data to edit
    const hasValidData = currentReleaseAmount > 0;

    return (
        <Modal
            title="Edit Principal Loan Amount"
            show={show}
            onClose={onClose}
            width="32rem"
        >
            <div className="p-4">
                {/* Client Info */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500">Client:</span>
                            <span className="ml-2 font-medium">{clientName}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Slot No:</span>
                            <span className="ml-2 font-medium">{slotNo}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Loan Cycle:</span>
                            <span className="ml-2 font-medium">{loanCycle}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Status:</span>
                            <span className="ml-2 font-medium capitalize">{status}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Occurence:</span>
                            <span className="ml-2 font-medium capitalize">{occurence}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Loan Terms:</span>
                            <span className="ml-2 font-medium">{loanTerms} {occurence === 'weekly' ? 'weeks' : 'days'}</span>
                        </div>
                    </div>
                </div>

                {!hasValidData ? (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-yellow-700 text-sm">
                            Unable to determine current loan values. The current release amount is zero or not available.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Original Values */}
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                            <h4 className="text-sm font-semibold text-blue-700 mb-2">Original Values</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-gray-600">Principal Loan:</span>
                                    <span className="ml-2 font-medium">{formatPricePhp(derivedPrincipalLoan)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Amount Release:</span>
                                    <span className="ml-2 font-medium">{formatPricePhp(currentReleaseAmount)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Service Charge Rate:</span>
                                    <span className="ml-2 font-medium">{(serviceChargeRate * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Input for New Principal Loan */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                New Principal Loan Amount
                            </label>
                            <input
                                type="number"
                                value={principalLoan}
                                onChange={handlePrincipalLoanChange}
                                onWheel={(e) => e.target.blur()}
                                step={1000}
                                min={1000}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    !isValid && principalLoan > 0 ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Enter principal loan amount"
                            />
                            {!isValid && principalLoan > 0 && (
                                <p className="text-xs text-red-500 mt-1">
                                    Amount must be divisible by ₱1,000
                                </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                Amount must be divisible by ₱1,000
                            </p>
                        </div>

                        {/* Calculated Values Preview */}
                        {principalLoan > 0 && (
                            <div className="mb-4 p-3 bg-green-50 rounded-lg">
                                <h4 className="text-sm font-semibold text-green-700 mb-2">Calculated Values (Preview)</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-gray-600">Amount Release:</span>
                                        <span className="ml-2 font-medium">{formatPricePhp(calculatedAmountRelease)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Loan Balance:</span>
                                        <span className="ml-2 font-medium">{formatPricePhp(calculatedLoanBalance)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">{occurence === 'weekly' ? 'Weekly' : 'Daily'} Payment:</span>
                                        <span className="ml-2 font-medium">{formatPricePhp(calculatedActiveLoan)}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Formula: {formatPricePhp(principalLoan)} × {(serviceChargeRate * 100).toFixed(0)}% = {formatPricePhp(calculatedAmountRelease)}
                                </p>
                            </div>
                        )}

                        {/* Changes Summary */}
                        {hasChanges && isValid && (
                            <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <h4 className="text-sm font-semibold text-yellow-700 mb-2">Changes Summary</h4>
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Principal Loan:</span>
                                        <span>
                                            <span className="text-red-500 line-through mr-2">{formatPricePhp(derivedPrincipalLoan)}</span>
                                            <span className="text-green-600 font-medium">{formatPricePhp(principalLoan)}</span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Amount Release:</span>
                                        <span>
                                            <span className="text-red-500 line-through mr-2">{formatPricePhp(currentReleaseAmount)}</span>
                                            <span className="text-green-600 font-medium">{formatPricePhp(calculatedAmountRelease)}</span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">{occurence === 'weekly' ? 'Weekly' : 'Daily'} Payment:</span>
                                        <span>
                                            <span className="text-red-500 line-through mr-2">{formatPricePhp(Math.round(currentReleaseAmount / loanTerms))}</span>
                                            <span className="text-green-600 font-medium">{formatPricePhp(calculatedActiveLoan)}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <ButtonOutline
                        label="Cancel"
                        onClick={onClose}
                        disabled={loading}
                    />
                    <ButtonSolid
                        label={loading ? 'Saving...' : 'Save Changes'}
                        onClick={handleSubmit}
                        disabled={loading || !isValid || !hasChanges || !hasValidData}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default EditAmountReleaseModal;