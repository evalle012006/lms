// src/components/laf/LAFOfflineConfirmation.js
// Shown after each offline LAF entry is saved to the queue.
// Summary card + Add Another Client + View Queue buttons.

import React from 'react';
import { CheckCircle, PlusCircle, List } from 'lucide-react';

const LAFOfflineConfirmation = ({
    entry,         // the queued entry object
    stats,         // { total, pending, synced, failed, isFull }
    onAddAnother,  // () => void — resets form for next client
    onViewQueue,   // () => void — opens LAFQueuePanel
    MAX_ENTRIES,
}) => {
    const name = entry?.formData
        ? `${entry.formData.firstName || ''} ${entry.formData.lastName || ''}`.trim()
        : 'Client';

    return (
        <div className="text-center space-y-5">
            {/* Icon */}
            <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-9 h-9 text-green-600" />
                </div>
            </div>

            {/* Title */}
            <div>
                <h2 className="text-lg font-bold text-gray-900">Saved Offline</h2>
                <p className="text-sm text-gray-500 mt-1">
                    <span className="font-semibold text-gray-800">{name}</span>{"'s"} application
                    has been saved to your device. It will be submitted when you are back online.
                </p>
            </div>

            {/* Queue counter */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                stats.isFull
                    ? 'bg-red-100 text-red-700'
                    : stats.pending >= MAX_ENTRIES * 0.8
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
            }`}>
                <List className="w-4 h-4" />
                {stats.pending} / {MAX_ENTRIES} clients queued
                {stats.isFull && ' — Queue full'}
            </div>

            {/* Do not refresh warning */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-left">
                <p className="text-xs font-semibold text-red-700 mb-0.5">
                    ⚠ Do not close or refresh this page
                </p>
                <p className="text-xs text-red-600">
                    Closing or refreshing will lose all queued applications.
                    Keep this page open until you are back online and have synced.
                </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
                {!stats.isFull && (
                    <button
                        type="button"
                        onClick={onAddAnother}
                        className="w-full flex items-center justify-center gap-2 py-3
                            bg-blue-600 text-white text-sm font-semibold rounded-xl
                            hover:bg-blue-700 transition-colors"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Add Another Client
                    </button>
                )}
                {stats.isFull && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                        Queue is full (30 clients). Please sync before adding more.
                    </div>
                )}
                <button
                    type="button"
                    onClick={onViewQueue}
                    className="w-full flex items-center justify-center gap-2 py-3
                        border-2 border-gray-200 text-gray-700 text-sm font-semibold
                        rounded-xl hover:bg-gray-50 transition-colors"
                >
                    <List className="w-4 h-4" />
                    View Queue ({stats.pending} pending)
                </button>
            </div>
        </div>
    );
};

export default LAFOfflineConfirmation;