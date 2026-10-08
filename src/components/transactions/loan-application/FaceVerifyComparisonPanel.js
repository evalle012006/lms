// src/components/transactions/loan-application/FaceVerifyComparisonPanel.js
// Shown right after a client clears the face-verification step in
// DisbursementPhotoModal (matched OR mismatched-then-skipped) — mirrors the
// enrolled-vs-captured comparison from the Face Verification Attempt Log
// page (settings/face-verify-attempts), reading the same persisted
// face_verify_attempts row rather than re-deriving it from FaceVerifyStep's
// in-memory result, so the two views can never disagree.
//
// Deliberately does NOT call face-verify-attempts/list (root-only) — uses
// the new for-review endpoint instead, which any authenticated approver can
// call.
import React, { useEffect, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import PhotoComparisonOverlay, { PhotoThumb } from '@/components/shared/PhotoComparisonOverlay';

const FaceVerifyComparisonPanel = ({ clientId, loanId, clientName }) => {
    const [attempt, setAttempt] = useState(undefined); // undefined = loading, null = no attempt found
    const [zoomOpen, setZoomOpen] = useState(false);

    useEffect(() => {
        if (!clientId) return;
        let cancelled = false;
        setAttempt(undefined);
        fetchWrapper.get(
            getApiBaseUrl() + 'face-verify-attempts/for-review?' +
            new URLSearchParams({ clientId, ...(loanId ? { loanId } : {}) })
        ).then(r => { if (!cancelled) setAttempt(r?.success ? (r.attempt || null) : null); })
         .catch(() => { if (!cancelled) setAttempt(null); });
        return () => { cancelled = true; };
    }, [clientId, loanId]);

    const enrollKey = attempt?.clientEnrollmentPhotoKey;
    const captureKey = attempt?.photo_key;
    const { urlMap } = useBulkSignedUrls([enrollKey, captureKey].filter(Boolean));

    if (attempt === undefined) {
        return <p className="text-[11px] text-gray-400 ml-1">Loading verification comparison…</p>;
    }
    if (!attempt) {
        return null; // nothing logged for this client — don't clutter the UI with an empty state
    }

    const enrollUrl = enrollKey ? urlMap[enrollKey] : null;
    const captureUrl = captureKey ? urlMap[captureKey] : null;

    return (
        <div className="border border-gray-100 rounded-lg p-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <PhotoThumb url={enrollUrl} label="Enrolled" onClick={() => setZoomOpen(true)} />
                <span className="text-gray-300 text-xs">vs</span>
                <PhotoThumb url={captureUrl} label="Captured" onClick={() => setZoomOpen(true)} />
            </div>
            <div className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    attempt.matched ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {attempt.matched ? 'Matched' : 'Mismatch'}
                </span>
                <p className="text-[10px] text-gray-400 mt-1">
                    {attempt.confidence != null ? `${attempt.confidence.toFixed(1)}% confidence` : 'No confidence score'}
                </p>
            </div>

            {zoomOpen && (
                <PhotoComparisonOverlay
                    leftUrl={enrollUrl}
                    rightUrl={captureUrl}
                    leftLabel="Enrolled"
                    rightLabel="Captured"
                    title={`Photo Comparison — ${clientName || attempt.client_id}`}
                    onClose={() => setZoomOpen(false)}
                />
            )}
        </div>
    );
};

export default FaceVerifyComparisonPanel;