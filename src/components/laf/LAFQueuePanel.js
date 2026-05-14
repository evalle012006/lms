// src/components/laf/LAFQueuePanel.js
// Slide-up panel showing all queued offline LAF entries.
// Shows status per entry (pending / synced / failed).

import React from 'react';
import { CheckCircle, XCircle, Clock, Trash2, X } from 'lucide-react';

const STATUS_CONFIG = {
    pending: { icon: Clock,       color: 'text-amber-500',  bg: 'bg-amber-50',  label: 'Queued'  },
    synced:  { icon: CheckCircle, color: 'text-green-500',  bg: 'bg-green-50',  label: 'Synced'  },
    failed:  { icon: XCircle,     color: 'text-red-500',    bg: 'bg-red-50',    label: 'Failed'  },
};

const LAFQueuePanel = ({ isOpen, onClose, queue, onRemove, isSyncing, syncProgress }) => {
    if (!isOpen) return null;

    const pending = queue.filter(e => e.status === 'pending').length;
    const synced  = queue.filter(e => e.status === 'synced').length;
    const failed  = queue.filter(e => e.status === 'failed').length;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

            {/* Panel */}
            <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Offline Queue</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {pending} pending · {synced} synced · {failed} failed
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100">
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                {/* Sync progress */}
                {isSyncing && syncProgress && (
                    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
                        <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            <span className="text-xs font-medium text-blue-700">
                                Syncing {syncProgress.current} of {syncProgress.total}...
                            </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-1.5">
                            <div
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Entry list */}
                <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
                    {queue.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-gray-400">No entries in queue</p>
                        </div>
                    ) : (
                        queue.map((entry, idx) => {
                            const cfg  = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
                            const Icon = cfg.icon;
                            const name = entry.formData
                                ? `${entry.formData.lastName || ''}, ${entry.formData.firstName || ''}`.trim().replace(/^,\s*/, '') || `Entry ${idx + 1}`
                                : `Entry ${idx + 1}`;

                            return (
                                <div key={entry.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg}`}>
                                    <Icon className={`w-5 h-5 flex-shrink-0 ${cfg.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {cfg.label}
                                            {entry.status === 'synced' && entry.ciReferenceCode &&
                                                ` · ${entry.ciReferenceCode}`}
                                            {entry.status === 'failed' && entry.syncError &&
                                                ` · ${entry.syncError}`}
                                        </p>
                                    </div>
                                    {entry.status === 'pending' && !isSyncing && onRemove && (
                                        <button type="button"
                                            onClick={() => onRemove(entry.id)}
                                            className="p-1.5 rounded-lg hover:bg-red-100 flex-shrink-0">
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default LAFQueuePanel;