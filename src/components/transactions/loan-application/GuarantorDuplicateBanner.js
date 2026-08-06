import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useSelector } from 'react-redux';

/**
 * GuarantorDuplicateBanner
 *
 * Shown inside the loan detail / edit view when loan.guarantorDuplicate === true.
 *
 * Rep ≤ 2 (admin): sees conflicting loans + Clear Flag / Reject actions.
 * Rep 3 (BM) + Rep 4 (LO): read-only banner — "Pending admin review."
 *
 * Props:
 *   loan       — the loan object (needs _id, guarantorFirstName, guarantorLastName, branchId)
 *   onResolved — callback after admin clears or rejects (triggers parent refresh)
 */
const GuarantorDuplicateBanner = ({ loan, onResolved }) => {
    const currentUser = useSelector(s => s.user.data);
    const rep = currentUser?.role?.rep;
    const isAdmin = rep <= 2;

    const [conflicts, setConflicts]       = useState([]);
    const [loadingConflicts, setLoadingConflicts] = useState(false);
    const [action, setAction]             = useState(null); // 'clear' | 'reject'
    const [reason, setReason]             = useState('');
    const [submitting, setSubmitting]     = useState(false);

    // Fetch conflicting loans
    useEffect(() => {
        if (!loan?._id) return;
        setLoadingConflicts(true);
        fetchWrapper.get(
            getApiBaseUrl() + 'transactions/loans/check-guarantor?' +
            new URLSearchParams({
                branchId:           loan.branchId,
                guarantorFirstName: loan.guarantorFirstName,
                guarantorLastName:  loan.guarantorLastName,
                excludeLoanId:      loan._id,
            })
        )
        .then(res => { if (res.success) setConflicts(res.loans || []); })
        .finally(() => setLoadingConflicts(false));
    }, [loan?._id]);

    const handleSubmit = async () => {
        if (!action) return;
        if (action === 'reject' && !reason.trim()) {
            toast.error('Please enter a reason for rejection.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/loans/clear-guarantor-flag',
                { loanId: loan._id, action, reason }
            );
            if (res.success) {
                toast.success(action === 'clear'
                    ? 'Guarantor flag cleared. Loan can now proceed to LDF approval.'
                    : 'Loan rejected due to guarantor issue.'
                );
                onResolved?.();
            } else {
                toast.error(res.message || 'Failed to update loan.');
            }
        } catch (e) {
            console.error(e);
            toast.error('An error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!loan?.guarantorDuplicate) return null;

    // ── BM / LO — read-only ───────────────────────────────────
    if (!isAdmin) {
        return (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                        <p className="text-sm font-semibold text-amber-800">Guarantor Review Pending</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            The guarantor <strong>{loan.guarantorFirstName} {loan.guarantorLastName}</strong> appears on other active or pending loans in this branch.
                            An admin must review and clear this flag before this loan can proceed to LDF approval.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Admin — full review UI ────────────────────────────────
    return (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-red-200">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                    <p className="text-sm font-semibold text-red-800">Duplicate Guarantor Flagged — Admin Review Required</p>
                    <p className="text-xs text-red-700 mt-0.5">
                        Guarantor <strong>{loan.guarantorFirstName} {loan.guarantorLastName}</strong> is already listed
                        on other active or pending loans in this branch. This loan is blocked from LDF approval
                        until you clear or reject it.
                    </p>
                </div>
            </div>

            {/* Conflicting loans table */}
            <div className="px-5 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Conflicting loans ({loadingConflicts ? '...' : conflicts.length})
                </p>

                {loadingConflicts ? (
                    <p className="text-xs text-gray-400">Loading...</p>
                ) : conflicts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                        No other matching loans found. The guarantor may have been resolved already.
                    </p>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Client</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Group</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Slot</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">PN Number</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conflicts.map(c => (
                                    <tr key={c._id} className="border-t border-gray-100">
                                        <td className="px-3 py-2 font-medium text-gray-900">{c.clientFullName}</td>
                                        <td className="px-3 py-2 text-gray-500">{c.groupName}</td>
                                        <td className="px-3 py-2 text-gray-500">{c.slotNo}</td>
                                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">{c.pnNumber || '—'}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                                c.status === 'active'  ? 'bg-green-100 text-green-700' :
                                                c.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Action selection */}
                {!action ? (
                    <div className="flex gap-3 mt-2">
                        <button
                            type="button"
                            onClick={() => setAction('clear')}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                            ✓ Clear Flag — Guarantor is Valid
                        </button>
                        <button
                            type="button"
                            onClick={() => setAction('reject')}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                            ✕ Reject Loan
                        </button>
                    </div>
                ) : (
                    <div className="mt-3">
                        {/* Confirmation UI */}
                        <div className={`p-4 rounded-lg border mb-3 ${
                            action === 'clear'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <p className="text-sm font-medium mb-2 text-gray-800">
                                {action === 'clear'
                                    ? '✓ Confirm: Clear the guarantor flag and allow LDF approval'
                                    : '✕ Confirm: Reject this loan due to guarantor issue'}
                            </p>
                            {action === 'reject' && (
                                <div className="mb-3">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        Reason for rejection (Required)
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        rows={2}
                                        placeholder="Enter reason..."
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
                                    />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors ${
                                        action === 'clear' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {submitting ? 'Processing...' : 'Confirm'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAction(null); setReason(''); }}
                                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuarantorDuplicateBanner;