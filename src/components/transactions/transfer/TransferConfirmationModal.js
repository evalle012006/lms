// src/components/transactions/transfer/TransferConfirmationModal.js
import React from 'react';
import Modal from '@/lib/ui/Modal';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import { formatPricePhp } from '@/lib/utils';
import { getTransferPreview } from '@/lib/transfer-recalculation';

/**
 * Shows source vs target details before an approve/create transfer POST fires.
 * If source and target occurence differ, shows the recalculated activeLoan /
 * loanTerms / noOfPayments preview using the same formula the server applies
 * authoritatively in approve-reject.js — this is a PREVIEW ONLY; the actual
 * numbers written to the DB are computed server-side.
 */
const TransferConfirmationModal = ({
    show,
    onClose,
    onConfirm,
    sourceGroup,
    targetGroup,
    sourceBranchName,
    targetBranchName,
    sourceUserName,
    targetUserName,
    client,
    targetLoanTerms,
}) => {
    if (!show) return null;

    const loan = (client?.loans && client.loans[0]) || {};
    const amountRelease = Number(loan.amountRelease) || 0;
    const loanBalance = Number(loan.loanBalance) || 0;
    const currentActiveLoan = Number(loan.activeLoan) || 0;
    const currentLoanTerms = Number(loan.loanTerms) || 0;
    const currentNoOfPayments = Number(loan.noOfPayments) || 0;

    const preview = getTransferPreview({
        sourceOccurence: sourceGroup?.occurence,
        targetOccurence: targetGroup?.occurence,
        targetWeeklyScheduleType: targetGroup?.weeklyScheduleType,
        targetLoanTerms,
        amountRelease,
        loanBalance,
        currentActiveLoan,
        currentLoanTerms,
        currentNoOfPayments,
    });

    const occurenceLabel = (occ) => occ === 'weekly' ? 'Weekly' : 'Daily';

    return (
        <Modal show={show} onClose={onClose} title="Confirm Client Transfer" size="lg" zIndex={200}>
            <div className="p-4 space-y-4">
                {preview.recalculated && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        This client is moving from a {occurenceLabel(sourceGroup?.occurence)} to a{' '}
                        {occurenceLabel(targetGroup?.occurence)} group. Because there is still a loan
                        balance, the installment amount will be recalculated below.
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-lg p-3">
                        <div className="text-xs uppercase text-gray-400 mb-2">Current (Source)</div>
                        <div className="text-sm space-y-1">
                            <div><span className="text-gray-500">Branch:</span> {sourceBranchName || '-'}</div>
                            <div><span className="text-gray-500">Loan Officer:</span> {sourceUserName || '-'}</div>
                            <div><span className="text-gray-500">Group:</span> {sourceGroup?.name || '-'}</div>
                            <div><span className="text-gray-500">Occurence:</span> {occurenceLabel(sourceGroup?.occurence)}</div>
                            <div className="pt-1 border-t border-gray-100 mt-1">
                                <span className="text-gray-500">Loan Terms:</span> {currentLoanTerms || '-'}
                            </div>
                            <div><span className="text-gray-500">Installment:</span> {formatPricePhp(currentActiveLoan)}</div>
                            <div><span className="text-gray-500">Loan Balance:</span> {formatPricePhp(loanBalance)}</div>
                            <div><span className="text-gray-500">Payments Made:</span> {currentNoOfPayments} / {currentLoanTerms}</div>
                        </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-3">
                        <div className="text-xs uppercase text-gray-400 mb-2">New (Target)</div>
                        <div className="text-sm space-y-1">
                            <div><span className="text-gray-500">Branch:</span> {targetBranchName || '-'}</div>
                            <div><span className="text-gray-500">Loan Officer:</span> {targetUserName || '-'}</div>
                            <div><span className="text-gray-500">Group:</span> {targetGroup?.name || '-'}</div>
                            <div><span className="text-gray-500">Occurence:</span> {occurenceLabel(targetGroup?.occurence)}</div>
                            <div className="pt-1 border-t border-gray-100 mt-1">
                                <span className="text-gray-500">Loan Terms:</span>{' '}
                                <span className={preview.recalculated ? 'font-semibold text-green-700' : ''}>
                                    {preview.loanTerms || '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Installment:</span>{' '}
                                <span className={preview.recalculated ? 'font-semibold text-green-700' : ''}>
                                    {formatPricePhp(preview.activeLoan)}
                                </span>
                            </div>
                            <div><span className="text-gray-500">Loan Balance:</span> {formatPricePhp(loanBalance)}</div>
                            <div>
                                <span className="text-gray-500">Payments Made:</span>{' '}
                                <span className={preview.recalculated ? 'font-semibold text-green-700' : ''}>
                                    {preview.noOfPayments} / {preview.loanTerms}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-gray-500">
                    Final figures are calculated by the server at approval time; this is a preview only.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                    <ButtonOutline label="Cancel" onClick={onClose} />
                    <ButtonSolid label="Confirm Transfer" onClick={onConfirm} />
                </div>
            </div>
        </Modal>
    );
};

export default TransferConfirmationModal;