// src/components/dashboard/DuplicateAlertsModal.js
// Dashboard modal listing duplicate groups where more than one loan is active at once.
// Read-only; admins get a link to the full Duplicate Clients page for review / merge.

import React from 'react';
import { X, Copy, ExternalLink } from 'lucide-react';
import moment from 'moment';

const DuplicateAlertsModal = ({ alerts, total, loading, isAdmin, onClose, onOpenPage }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <Copy className="w-5 h-5 text-red-500" />
                    <h2 className="text-lg font-bold text-gray-900">Duplicate Alerts</h2>
                    <span className="text-xs text-gray-500">more than one active loan for the same person</span>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <button type="button" onClick={onOpenPage}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                            Review &amp; merge <ExternalLink className="w-4 h-4" />
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <p className="text-center text-sm text-gray-400 py-10">Loading…</p>
                ) : alerts.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-10">No duplicate alerts. 🎉</p>
                ) : alerts.map(a => (
                    <div key={a.clusterId} className="border border-red-200 rounded-lg overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-red-50 text-xs">
                            <span className="font-semibold text-red-700">{a.activeCount} active loans</span>
                            <span className="text-gray-600">
                                {a.view === 'same_client' ? 'Same client ID' : `${a.memberCount} client records`}
                            </span>
                            <span className="text-gray-400 ml-auto">
                                Detected {a.firstDetectedAt ? moment(a.firstDetectedAt).format('MMM D, YYYY') : '—'}
                            </span>
                        </div>
                        <ul className="divide-y divide-gray-100 text-sm">
                            {a.members.map((m, i) => (
                                <li key={m._id ?? i} className="px-3 py-2">
                                    {m.inScope ? (
                                        <>
                                            <p className="font-medium text-gray-900">{m.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {[m.branchName, m.loName, m.groupName].filter(Boolean).join(' · ') || '—'}
                                                {m.hasActiveLoan && (
                                                    <span className="ml-1 text-red-600 font-semibold">
                                                        · Active{m.activeLoan?.loanCycle ? ` C${m.activeLoan.loanCycle}` : ''}
                                                        {m.activeLoan?.loanBalance != null && ` · ₱${Number(m.activeLoan.loanBalance).toLocaleString()}`}
                                                    </span>
                                                )}
                                            </p>
                                            {m.activeLoans?.map(l => (
                                                <p key={l._id} className="text-xs text-red-700">
                                                    Loan cycle {l.loanCycle} · slot {l.slotNo ?? '—'} · ₱{Number(l.loanBalance ?? 0).toLocaleString()} balance
                                                </p>
                                            ))}
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-500 italic">
                                            Matching record in another branch{m.branchName ? ` (${m.branchName})` : ''}
                                            {m.hasActiveLoan && <span className="text-red-600 font-semibold"> · has an active loan</span>}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                {total > alerts.length && (
                    <p className="text-xs text-center text-gray-500">Showing {alerts.length} of {total}.</p>
                )}
            </div>
        </div>
    </div>
);

export default DuplicateAlertsModal;
