import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import PhotoCapture from '@/components/clients/PhotoCapture';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useCIDraftStorage } from '@/hooks/useCIDraftStorage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const CIReviewPanel = ({ applicationData, investigationData, onSaved }) => {
    const currentUser = useSelector(state => state.user.data);
    const isOnline = useOnlineStatus();
    const { saveDraft } = useCIDraftStorage();

    const { application, lafPhotoUrl } = applicationData;

    const [findings,         setFindings]         = useState(investigationData?.findings || '');
    const [businessVerified, setBusinessVerified] = useState(investigationData?.businessVerified || false);
    const [addressVerified,  setAddressVerified]  = useState(investigationData?.addressVerified  || false);
    const [decision,         setDecision]         = useState(investigationData?.decision || '');
    const [declineReason,    setDeclineReason]    = useState(investigationData?.declineReason || '');
    const [selfieFile,       setSelfieFile]       = useState(null);
    const [saving,           setSaving]           = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl]   = useState(null);

    const buildPayload = useCallback((selfieKey = null) => ({
        ciReferenceCode:  application.ciReferenceCode,
        tempApplicationId: application._id,
        findings,
        businessVerified,
        addressVerified,
        decision,
        declineReason: decision === 'declined' ? declineReason : null,
        selfieKey,
        investigatedAt: new Date().toISOString(),
    }), [application, findings, businessVerified, addressVerified,
        decision, declineReason]);

    const handleSave = useCallback(async () => {
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
            let selfieKey = investigationData?.selfieKey || null;

            // Upload selfie if new file selected
            if (selfieFile) {
                const fd = new FormData();
                fd.append('file', selfieFile);
                fd.append('origin', 'ci-selfies');
                fd.append('uuid', application._id);
                const uploadRes  = await fetch('/api/upload', { method: 'POST', body: fd });
                const uploadData = await uploadRes.json();
                if (!uploadData.fileKey) throw new Error('Selfie upload failed.');
                selfieKey = uploadData.fileKey;
            }

            const payload = buildPayload(selfieKey);

            if (!isOnline) {
                // Save to localStorage draft
                saveDraft({
                    ...payload,
                    savedOfflineAt: Date.now(),
                });
                toast.success('Saved offline. Will sync when back online.');
                onSaved?.({ offline: true });
                return;
            }

            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/ci/investigate',
                payload
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
                    <p className="text-xs font-semibold text-gray-500 uppercase 
                        tracking-wide mb-2">Application Photo (LAF)</p>
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
                                : 'border-gray-200 text-gray-500 hover:border-green-300'
                        }`}
                    >
                        <CheckCircle className="w-5 h-5" />
                        Approve
                    </button>
                    <button
                        type="button"
                        onClick={() => setDecision('declined')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3
                            rounded-xl border-2 text-sm font-medium transition-colors ${
                            decision === 'declined'
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 text-gray-500 hover:border-red-300'
                        }`}
                    >
                        <XCircle className="w-5 h-5" />
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
                        placeholder="State the reason for declining..."
                        className="w-full px-3 py-2.5 border border-red-300 rounded-lg
                            text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                </div>
            )}

            {/* Selfie — only shown when approving */}
            {decision === 'approved' && (
                <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                        Visit Selfie * <span className="text-xs text-gray-400 font-normal">
                            (Must show CI, client, and physical form)
                        </span>
                    </p>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                        <div className="flex gap-2 items-start">
                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">
                                Photo must clearly show: <strong>you (CI)</strong>, 
                                the <strong>client</strong>, and the 
                                <strong> filled-out physical form</strong>. 
                                Your name ({currentUser?.firstName} {currentUser?.lastName}) 
                                will be automatically recorded.
                            </p>
                        </div>
                    </div>
                    {investigationData?.selfieUrl && !selfieFile && (
                        <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-2">Previously uploaded selfie:</p>
                            
                            {/* Clickable thumbnail */}
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
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30
                                    transition-all flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100
                                        transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                </div>
                            </button>
                            <p className="text-xs text-gray-400 mt-1">Click to view full image</p>
                        </div>
                    )}

                    {/* Full image preview lightbox */}
                    {previewOpen && previewUrl && (
                        <div
                            className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center
                                justify-center p-4"
                            onClick={() => setPreviewOpen(false)}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setPreviewOpen(false)}
                                className="absolute top-4 right-4 p-2 text-white hover:text-gray-300
                                    bg-white bg-opacity-10 rounded-full hover:bg-opacity-20 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* Image — click outside to close */}
                            <img
                                src={previewUrl}
                                alt="CI selfie full view"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                onClick={e => e.stopPropagation()} // don't close when clicking image itself
                            />

                            {/* Tap anywhere to close hint */}
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
                        Saving…
                    </>
                ) : isOnline ? 'Save Investigation' : 'Save Draft (Offline)'}
            </button>
        </div>
    );
};

export default CIReviewPanel;