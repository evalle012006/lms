import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { formatPricePhp } from '@/lib/utils';
import PrivateImage from '@/components/common/PrivateImage';
import Spinner from '@/components/Spinner';
import moment from 'moment';

/**
 * LDFApprovalDetailsModal
 *
 * Opens from the "View Approval Details" action in LDF Approved Applications.
 * Shows:
 * - Loan summary (client, PN number, amount, date)
 * - Approving officer details
 * - Disbursement photo
 */
const LDFApprovalDetailsModal = ({ show, loan, onClose }) => {
    const [approver, setApprover]   = useState(null);
    const [loading, setLoading]     = useState(false);
    const [imgError, setImgError]   = useState(false);

    // Load approver details when modal opens
    useEffect(() => {
        if (!show || !loan?.ldfApprovedBy) return;
        setApprover(null);
        setLoading(true);
        fetchWrapper
            .get(getApiBaseUrl() + 'users?' +
                new URLSearchParams({ _id: loan.ldfApprovedBy }))
            .then(r => {
                if (r.success) setApprover(r.user);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [show, loan]);

    if (!show || !loan) return null;

    const roleMap = {
        'branch_manager':   'Branch Manager',
        'area_admin':       'Area Manager',
        'regional_manager': 'Regional Manager',
        'deputy_director':  'Deputy Director',
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">LDF Approval Details</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Disbursement confirmation record</p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* ── Loan Info ──────────────────────────────────────── */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircleIcon className="w-4 h-4 text-blue-600" />
                            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                                Loan Information
                            </p>
                        </div>
                        <Row label="Client" value={loan.fullName || loan.clientName} />
                        <Row label="PN Number" value={loan.pnNumber} mono />
                        <Row label="Group" value={`${loan.groupName} · Slot ${loan.slotNo}`} />
                        <Row label="Principal Loan" value={formatPricePhp(loan.principalLoan)} />
                        <Row label="Amount Released" value={formatPricePhp(loan.amountRelease || loan.loanRelease)} />
                        <Row label="Date of Release" value={loan.dateOfRelease
                            ? moment(loan.dateOfRelease).format('MMM D, YYYY') : '—'} />
                        <Row label="LDF Approved Date" value={loan.ldfApprovedDate
                            ? moment(loan.ldfApprovedDate).format('MMM D, YYYY') : '—'} />
                    </div>

                    {/* ── Approving Officer ──────────────────────────────── */}
                    <div>
                        <p className="text-sm font-semibold text-gray-700 mb-3">Approving Officer</p>
                        {loading ? (
                            <div className="flex justify-center py-4"><Spinner /></div>
                        ) : approver ? (
                            <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl">
                                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center
                                    justify-center flex-shrink-0 overflow-hidden">
                                    {approver.profile ? (
                                        <PrivateImage
                                            src={approver.profile}
                                            alt={`${approver.firstName} ${approver.lastName}`}
                                            width={48} height={48}
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        <UserCircleIcon className="w-8 h-8 text-teal-600" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {approver.firstName} {approver.lastName}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {roleMap[approver.role?.shortCode] || approver.role?.label || 'Officer'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">{approver.email}</p>
                                </div>
                                {/* Biometric badge */}
                                {approver.biometricCredentialId && (
                                    <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1
                                        bg-teal-50 border border-teal-200 rounded-lg">
                                        <svg className="w-3.5 h-3.5 text-teal-600" fill="none"
                                            stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                        </svg>
                                        <span className="text-xs text-teal-700 font-medium">Biometric</span>
                                    </div>
                                )}
                            </div>
                        ) : loan.ldfApprovedBy ? (
                            <p className="text-sm text-gray-400 italic">Approver details unavailable</p>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No approver recorded</p>
                        )}
                    </div>

                    {/* ── Disbursement Photo ──────────────────────────────── */}
                    <div>
                        <p className="text-sm font-semibold text-gray-700 mb-3">Disbursement Photo</p>
                        {loan.disbursementPhotoKey ? (
                            <div className="space-y-2">
                                <PrivateImage
                                    src={loan.disbursementPhotoKey}
                                    alt="Disbursement"
                                    width={480}
                                    height={300}
                                    className="w-full h-64 object-cover rounded-xl border border-gray-200"
                                />
                                {loan.disbursementPhotoAt && (
                                    <p className="text-xs text-gray-400 text-right">
                                        Taken on {moment(loan.disbursementPhotoAt).format('MMM D, YYYY h:mm A')}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40
                                border-2 border-dashed border-gray-200 rounded-xl">
                                <p className="text-sm text-gray-400">No disbursement photo on record</p>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50 sticky bottom-0">
                    <button type="button" onClick={onClose}
                        className="px-6 py-2.5 text-sm font-medium text-gray-700
                            border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simple label-value row
const Row = ({ label, value, mono = false }) => (
    <div className="flex items-start justify-between gap-4">
        <span className="text-xs text-blue-600 flex-shrink-0">{label}</span>
        <span className={`text-xs font-medium text-blue-900 text-right ${mono ? 'font-mono' : ''}`}>
            {value || '—'}
        </span>
    </div>
);

export default LDFApprovalDetailsModal;