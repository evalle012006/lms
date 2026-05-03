import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import PhotoCapture from '@/components/clients/PhotoCapture';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useCIDraftStorage } from '@/hooks/useCIDraftStorage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

// ── Helper: convert File to base64 data URL ──────────────────────────────
// Used when offline — stores selfie locally instead of uploading to S3
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror  = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

const CIReviewPanel = ({ applicationData, investigationData, onSaved }) => {
    const currentUser = useSelector(state => state.user.data);
    const isOnline    = useOnlineStatus();
    const { saveDraft } = useCIDraftStorage();

    const { application, lafPhotoUrl } = applicationData;

    const [findings,         setFindings]         = useState(investigationData?.findings        || '');
    const [businessVerified, setBusinessVerified] = useState(investigationData?.businessVerified || false);
    const [addressVerified,  setAddressVerified]  = useState(investigationData?.addressVerified  || false);
    const [decision,         setDecision]         = useState(investigationData?.decision         || '');
    const [declineReason,    setDeclineReason]    = useState(investigationData?.declineReason    || '');
    const [selfieFile,       setSelfieFile]       = useState(null);
    const [saving,           setSaving]           = useState(false);
    const [previewOpen,      setPreviewOpen]      = useState(false);
    const [previewUrl,       setPreviewUrl]       = useState(null);

    const buildPayload = useCallback((selfieKey = null) => ({
        ciReferenceCode:   application.ciReferenceCode,
        tempApplicationId: application._id,
        findings,
        businessVerified,
        addressVerified,
        decision,
        declineReason: decision === 'declined' ? declineReason : null,
        selfieKey,
        investigatedAt: new Date().toISOString(),
    }), [application, findings, businessVerified, addressVerified, decision, declineReason]);

    const handleSave = useCallback(async () => {
        // ── Validation ────────────────────────────────────────────────────
        if (!decision) {
            toast.error('Please select Approve or Decline.');
            return;
        }
        if (decision === 'approved' && !selfieFile && !investigationData?.selfieKey) {
            toast.error('A selfie photo is required to approve an application.');
            return;
        }
        if (decision === 'declined' && !declineReason.trim()) {
            toast.error('Please provide a decline reason.');
            return;
        }

        setSaving(true);

        try {
            // ── OFFLINE PATH ──────────────────────────────────────────────
            // Check online status BEFORE attempting any network calls.
            // Store selfie as base64 in localStorage — upload during sync.
            if (!isOnline) {
                let selfieBase64 = null;
                if (selfieFile) {
                    // Convert file to base64 so it can be stored in localStorage
                    // and uploaded to S3 when the device comes back online
                    selfieBase64 = await fileToBase64(selfieFile);
                }

                saveDraft({
                    ...buildPayload(null), // selfieKey is null — will be set after upload on sync
                    selfieBase64,          // raw image data stored locally
                    savedOfflineAt: Date.now(),
                });

                toast.success('Saved offline. Will sync when back online.');
                onSaved?.({ offline: true });
                return;
            }

            // ── ONLINE PATH ───────────────────────────────────────────────
            let selfieKey = investigationData?.selfieKey || null;

            // Upload selfie to S3 if a new file was selected
            if (selfieFile) {
                const fd = new FormData();
                fd.append('file', selfieFile);
                fd.append('origin', 'ci-selfies');
                fd.append('uuid', application._id);
                const uploadRes  = await fetch('/api/upload', { method: 'POST', body: fd });
                const ct         = uploadRes.headers.get('content-type') || '';
                if (!ct.includes('application/json')) {
                    throw new Error(`Upload error (${uploadRes.status}). Please try again.`);
                }
                const uploadData = await uploadRes.json();
                if (!uploadData.fileKey) throw new Error('Selfie upload failed.');
                selfieKey = uploadData.fileKey;
            }

            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/ci/investigate',
                buildPayload(selfieKey)
            );

            if (!res.success) throw new Error(res.message || 'Save failed.');
            toast.success('Investigation saved successfully.');
            onSaved?.({ offline: false, investigation: res.investigation });

        } catch (err) {
            toast.error(err.message || 'An error occurred.');
        } finally {
            setSaving(false);
        }
    }, [decision, declineReason, selfieFile, investigationData,
        isOnline, buildPayload, saveDraft, onSaved, application]);

    return (
        <div className="space-y-6">

            {/* LAF photo display */}
            {lafPhotoUrl && (
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Application Photo (LAF)
                    </p>
                    <img
                        src={lafPhotoUrl}
                        alt="Client LAF photo"
                        className="w-32 h-32 object-cover rounded-xl border"
                    />
                </div>
            )}

            {/* Findings */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Investigation Findings
                </label>
                <textarea
                    rows={4}
                    value={findings}
                    onChange={e => setFindings(e.target.value)}
                    placeholder="Describe what you observed during the field visit..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
            </div>

            {/* Verification checkboxes */}
            <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={businessVerified}
                        onChange={e => setBusinessVerified(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600" />
                    <span className="text-sm text-gray-700">Business verified</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={addressVerified}
                        onChange={e => setAddressVerified(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600" />
                    <span className="text-sm text-gray-700">Address verified</span>
                </label>
            </div>

            {/* Decision */}
            <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Decision *</p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setDecision('approved')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3
                            rounded-xl border-2 text-sm font-medium transition-colors ${
                            decision === 'approved'
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 text-gray-600 hover:border-green-300'
                        }`}
                    >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                    </button>
                    <button
                        type="button"
                        onClick={() => setDecision('declined')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3
                            rounded-xl border-2 text-sm font-medium transition-colors ${
                            decision === 'declined'
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 text-gray-600 hover:border-red-300'
                        }`}
                    >
                        <XCircle className="w-4 h-4" />
                        Decline
                    </button>
                </div>
            </div>

            {/* Decline reason */}
            {decision === 'declined' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Decline Reason *
                    </label>
                    <textarea
                        rows={3}
                        value={declineReason}
                        onChange={e => setDeclineReason(e.target.value)}
                        placeholder="Explain why this application is being declined..."
                        className="w-full px-3 py-2.5 border border-red-300 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                </div>
            )}

            {/* Selfie section */}
            {decision === 'approved' && (
                <div>
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200
                        rounded-xl mb-3">
                        <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-blue-800">
                                Selfie required for approval
                            </p>
                            <p className="text-xs text-blue-600 mt-0.5">
                                Take a selfie together with the client holding their application form.
                                Your name ({currentUser?.firstName} {currentUser?.lastName}) will be
                                automatically recorded.
                                {!isOnline && (
                                    <span className="block mt-1 font-medium text-amber-700">
                                        ⚠ Offline — selfie will be stored locally and uploaded when you reconnect.
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Previously uploaded selfie */}
                    {investigationData?.selfieUrl && !selfieFile && (
                        <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-2">Previously uploaded selfie:</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewUrl(investigationData.selfieUrl);
                                    setPreviewOpen(true);
                                }}
                                className="relative group rounded-xl overflow-hidden border border-gray-200
                                    hover:border-blue-400 transition-colors block"
                            >
                                <img
                                    src={investigationData.selfieUrl}
                                    alt="CI selfie"
                                    className="w-28 h-28 object-cover"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30
                                    transition-all flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100
                                        transition-opacity" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/>
                                    </svg>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Full-screen selfie preview */}
                    {previewOpen && previewUrl && (
                        <div
                            className="fixed inset-0 z-[9999] bg-black bg-opacity-90
                                flex items-center justify-center p-4"
                            onClick={() => setPreviewOpen(false)}
                        >
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(false)}
                                className="absolute top-4 right-4 text-white bg-black bg-opacity-50
                                    rounded-full p-2 hover:bg-opacity-70"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                        strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                            <img
                                src={previewUrl}
                                alt="CI selfie full view"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            />
                            <p className="absolute bottom-4 left-0 right-0 text-center text-white
                                text-xs opacity-50">
                                Tap anywhere outside to close
                            </p>
                        </div>
                    )}

                    <PhotoCapture
                        onFileReady={setSelfieFile}
                        label="Take selfie with client and form"
                        facingMode="user"
                        maxMB={10}
                    />
                </div>
            )}

            {/* Save button */}
            <button
                type="button"
                onClick={handleSave}
                disabled={saving || !decision}
                className="w-full py-3 bg-blue-600 text-white text-sm font-semibold
                    rounded-xl hover:bg-blue-700 disabled:opacity-50
                    disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {isOnline ? 'Saving…' : 'Saving draft…'}
                    </>
                ) : isOnline ? 'Save Investigation' : 'Save Draft (Offline)'}
            </button>
        </div>
    );
};

export default CIReviewPanel;