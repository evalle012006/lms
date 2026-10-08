// src/components/transactions/loan-application-v2/ApprovalActionBar.js
// Selection summary + the one primary approval action for the current tab:
//   tab 'ldf'          -> "LDF approve (n)"
//   tab 'application'  -> "Approve loans (n)"
// When the action is currently not allowed (cutoff time, weekend, holiday,
// locked branch) the button is disabled and the reason is shown in a banner,
// instead of the button silently disappearing as it did on the classic page.

import React from 'react';
import { Clock, Loader2 } from 'lucide-react';

const TAB_ACTION = {
    ldf: { label: 'LDF approve', busyKey: 'ldf' },
    application: { label: 'Approve loans', busyKey: 'application' },
};

export default function ApprovalActionBar({
    tab, selectedCount, totalOnTab, busy, disabledReason,
    onSelectAll, onClear, onPrimary,
}) {
    const action = TAB_ACTION[tab];
    if (!action) return null;

    const working = busy === action.busyKey;
    const disabled = !!busy || selectedCount === 0 || !!disabledReason;

    return (
        <div className="mb-3">
            {disabledReason && (
                <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <Clock className="h-5 w-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{disabledReason}</p>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span>
                        <span className="font-semibold text-gray-900">{selectedCount}</span> selected
                    </span>
                    <button
                        type="button"
                        onClick={onSelectAll}
                        disabled={!!busy || totalOnTab === 0}
                        className="font-medium text-teal-700 hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                        {busy === 'select-all' ? 'Selecting…' : `Select all ${totalOnTab} on this tab`}
                    </button>
                    {selectedCount > 0 && (
                        <button
                            type="button"
                            onClick={onClear}
                            disabled={!!busy}
                            className="font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onPrimary}
                    disabled={disabled}
                    title={disabledReason || (selectedCount === 0 ? 'Select at least one loan' : undefined)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-teal-600"
                >
                    {working && <Loader2 className="w-4 h-4 animate-spin" />}
                    {working ? 'Working…' : `${action.label}${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
                </button>
            </div>
        </div>
    );
}