import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ClientDuplicateWarning = ({ candidates = [], onDismiss }) => {
    if (!candidates || candidates.length === 0) return null;

    return (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800">
                            Possible duplicate client detected
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            The following existing clients have similar names. 
                            Verify this is not a duplicate before saving. 
                            Proceeding will flag this client for BM review.
                        </p>
                    </div>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        type="button"
                        className="text-amber-500 hover:text-amber-700 text-xs underline 
                            flex-shrink-0 mt-0.5"
                    >
                        Dismiss
                    </button>
                )}
            </div>

            <div className="mt-3 space-y-2">
                {candidates.slice(0, 5).map((c, i) => (
                    <div
                        key={c._id || i}
                        className="flex items-center justify-between bg-white 
                            border border-amber-200 rounded-lg px-3 py-2 text-xs"
                    >
                        <span className="font-medium text-gray-800">
                            {c.lastName}, {c.firstName} {c.middleName || ''}
                        </span>
                        <span className="text-gray-500 mx-2 truncate max-w-[120px]">
                            {c.branchName || '—'}
                        </span>
                        <span className={`font-semibold flex-shrink-0 ${
                            (c.similarityScore || 0) >= 0.95
                                ? 'text-red-600'
                                : 'text-amber-600'
                        }`}>
                            {Math.round((c.similarityScore || 0) * 100)}% match
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ClientDuplicateWarning;