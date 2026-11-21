// src/components/transactions/loan-application-v2/ApprovalDialogs.js
// Small self-contained dialogs for the approval flow:
//   RejectLoanDialog  — required reason, then confirm
//   ReinstateLoanDialog — required reason, then put a rejected loan back to pending
//   BlockersDialog    — the loans in a selection that cannot be approved, and why
// Both close on Escape and on a click outside the panel.

import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { UppercaseFirstLetter } from '@/lib/utils';

function Shell({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
            onClick={onClose}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="w-full max-w-md bg-white rounded-xl shadow-xl max-h-full flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function RejectLoanDialog({ loan, busy, onCancel, onConfirm }) {
    const [reason, setReason] = useState('');
    if (!loan) return null;

    const name = UppercaseFirstLetter(loan.client?.fullName || loan.fullName || 'this client');

    return (
        <Shell title="Reject loan" onClose={busy ? () => {} : onCancel}>
            <div className="px-5 py-4 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-3">
                    Reject the loan for <span className="font-medium text-gray-900">{name}</span>
                    {loan.groupName ? ` (${UppercaseFirstLetter(loan.groupName)})` : ''}. This cannot be undone from this page.
                </p>
                <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="reject-reason">
                    Reason (required)
                </label>
                <textarea
                    id="reject-reason"
                    rows={4}
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this loan being rejected?"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => onConfirm(reason)}
                    disabled={busy || !reason.trim()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Reject loan
                </button>
            </div>
        </Shell>
    );
}

export function ReinstateLoanDialog({ loan, busy, onCancel, onConfirm }) {
    const [reason, setReason] = useState('');
    if (!loan) return null;

    const name = UppercaseFirstLetter(loan.client?.fullName || loan.fullName || 'this client');

    return (
        <Shell title="Reinstate rejected loan" onClose={busy ? () => {} : onCancel}>
            <div className="px-5 py-4 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-2">
                    Reinstate the loan for <span className="font-medium text-gray-900">{name}</span>
                    {loan.groupName ? ` (${UppercaseFirstLetter(loan.groupName)}, slot ${loan.slotNo})` : ''}.
                </p>
                <p className="text-xs text-gray-500 mb-3">
                    The loan goes back to <span className="font-medium">pending</span> and must be LDF-approved and
                    approved again. Its group slot is taken again, so this fails if the slot is no longer free. If the
                    release date has passed, the branch manager has to change it before approving. This is recorded in the audit log.
                </p>
                {loan.rejectReason && (
                    <p className="text-xs text-red-600 mb-3" title={loan.rejectReason}>
                        Rejected because: {loan.rejectReason}
                    </p>
                )}
                <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="reinstate-reason">
                    Reason for reinstating (required)
                </label>
                <textarea
                    id="reinstate-reason"
                    rows={4}
                    autoFocus
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this loan being reinstated?"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => onConfirm(reason)}
                    disabled={busy || !reason.trim()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Reinstate loan
                </button>
            </div>
        </Shell>
    );
}

export function BlockersDialog({ messages, onClose }) {
    if (!messages || messages.length === 0) return null;
    return (
        <Shell title="These loans cannot be approved yet" onClose={onClose}>
            <ul className="px-5 py-4 space-y-2 overflow-y-auto">
                {messages.map((m) => (
                    <li key={m} className="text-sm text-gray-700 pl-3 border-l-2 border-red-300">{m}</li>
                ))}
            </ul>
            <div className="flex justify-end px-5 py-3 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 rounded-lg bg-teal-600 text-sm font-medium text-white hover:bg-teal-700"
                >
                    Got it
                </button>
            </div>
        </Shell>
    );
}