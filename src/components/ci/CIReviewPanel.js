// src/components/ci/CIReviewPanel.js
// FIX: businessVerified and addressVerified are now required before saving
// FIX: Checkboxes show visual confirmed state with green styling + checkmark

import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import PhotoCapture from '@/components/clients/PhotoCapture';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useCIDraftStorage } from '@/hooks/useCIDraftStorage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import CIDuplicatePanel from '@/components/ci/CIDuplicatePanel';
import { checkRealConnectivity } from '@/lib/check-online';

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror  = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function compressToBase64(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale  = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            fileToBase64(file).then(resolve).catch(reject);
        };
        img.src = url;
    });
}

const CIQuestion = ({ question, index, answer, onChange }) => (
    <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
            {index + 1}. {question.question}
            {question.required && <span className="ml-1 text-red-500 text-xs">*</span>}
            {!question.required && <span className="ml-1 text-gray-400 text-xs font-normal">(optional)</span>}
        </label>
        {question.answerType === 'yesno' ? (
            <div className="flex gap-4">
                {['Yes', 'No'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`ci_q_${question.id}`} value={opt}
                            checked={answer === opt} onChange={() => onChange(opt)}
                            className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                ))}
            </div>
        ) : (
            <textarea rows={2} value={answer || ''} onChange={e => onChange(e.target.value)}
                placeholder="Enter your answer..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-gray-50" />
        )}
    </div>
);

const CIReviewPanel = ({ applicationData, investigationData, onSaved }) => {
    const currentUser    = useSelector(state => state.user.data);
    const systemSettings = useSelector(state => state.systemSettings.data);
    const isOnline       = useOnlineStatus();
    const { saveDraft }  = useCIDraftStorage();

    const { application, lafPhotoUrl } = applicationData;

    const ciQuestions = Array.isArray(systemSettings?.ciQuestions)
        ? systemSettings.ciQuestions : [];

    const initialAnswers = () => {
        const map = {};
        (investigationData?.ciAnswers || []).forEach(a => { map[a.questionId] = a.answer; });
        return map;
    };

    const [answers,          setAnswers]          = useState(initialAnswers);
    const [businessVerified, setBusinessVerified] = useState(investigationData?.businessVerified || false);
    const [addressVerified,  setAddressVerified]  = useState(investigationData?.addressVerified  || false);
    const [decision,         setDecision]         = useState(investigationData?.decision         || '');
    const [declineReason,    setDeclineReason]    = useState(investigationData?.declineReason    || '');
    const [selfieFile,       setSelfieFile]       = useState(null);
    const [saving,           setSaving]           = useState(false);
    const [previewOpen,      setPreviewOpen]      = useState(false);
    const [previewUrl,       setPreviewUrl]       = useState(null);

    const handleAnswerChange = (questionId, value) =>
        setAnswers(prev => ({ ...prev, [questionId]: value }));

    const buildCiAnswers = useCallback(() =>
        ciQuestions.map(q => ({
            questionId: q.id, question: q.question,
            answerType: q.answerType, required: q.required,
            answer: answers[q.id] || '',
        }))
    , [ciQuestions, answers]);

    const buildPayload = useCallback((selfieKey = null) => ({
        ciReferenceCode:   application.ciReferenceCode,
        tempApplicationId: application._id,
        findings:          '',
        businessVerified,  addressVerified, decision,
        declineReason: decision === 'declined' ? declineReason : null,
        selfieKey,
        ciAnswers:     buildCiAnswers(),
        investigatedAt: new Date().toISOString(),
    }), [application, businessVerified, addressVerified, decision, declineReason, buildCiAnswers]);

    const handleSave = useCallback(async () => {
        if (application?.status === 'pending_validation') {
            toast.error('This application requires admin duplicate validation before CI can be saved.');
            return;
        }
        if (!decision) { toast.error('Please select Approve or Decline.'); return; }

        // FIX: businessVerified and addressVerified are required before saving
        if (!businessVerified) {
            toast.error('Please confirm that the business has been verified.');
            return;
        }
        if (!addressVerified) {
            toast.error('Please confirm that the address has been verified.');
            return;
        }

        const unanswered = ciQuestions.filter(q => q.required && !answers[q.id]?.trim());
        if (unanswered.length > 0) {
            toast.error(`Please answer all required questions: ${unanswered.map((q, i) => `${i + 1}. ${q.question}`).join(', ')}`);
            return;
        }
        if (decision === 'approved' && !selfieFile && !investigationData?.selfieKey && !investigationData?.selfieUrl) {
            toast.error('A selfie photo is required to approve an application.');
            return;
        }
        if (decision === 'declined' && !declineReason.trim()) {
            toast.error('Please provide a decline reason.');
            return;
        }

        setSaving(true);
        try {
            // ── OFFLINE PATH ─────────────────────────────────────────────
            // Real probe — navigator.onLine unreliable on mobile networks
            const reallyOnline = isOnline ? await checkRealConnectivity() : false;
            if (!reallyOnline) {
                let selfieBase64 = null;
                if (selfieFile) selfieBase64 = await compressToBase64(selfieFile);
                const saveResult = saveDraft({ ...buildPayload(null), selfieBase64, savedOfflineAt: Date.now() });
                if (saveResult?.success === false) {
                    toast.error('Could not save offline: device storage full.');
                    return;
                }
                toast.success('Saved offline. Will sync when back online.');
                onSaved?.({ offline: true });
                return;
            }

            // ── ONLINE PATH ──────────────────────────────────────────────
            let selfieKey = investigationData?.selfieKey || null;
            if (selfieFile) {
                const fd = new FormData();
                fd.append('file', selfieFile);
                fd.append('origin', 'ci-selfies');
                fd.append('uuid', application._id);
                const uploadRes  = await fetch('/api/upload', { method: 'POST', body: fd });
                const ct         = uploadRes.headers.get('content-type') || '';
                if (!ct.includes('application/json'))
                    throw new Error(`Upload error (${uploadRes.status}). Please try again.`);
                const uploadData = await uploadRes.json();
                if (!uploadData.fileKey) throw new Error('Selfie upload failed.');
                selfieKey = uploadData.fileKey;
            }

            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/ci/investigate', buildPayload(selfieKey)
            );
            if (!res.success) throw new Error(res.message || 'Save failed.');

            // ── Auto-promote after CI approval ────────────────────────────
            if (decision === 'approved') {
                try {
                    const promoteRes = await fetchWrapper.get(
                        getApiBaseUrl() + `laf/promote/${encodeURIComponent(application.ciReferenceCode)}`
                    );
                    if (promoteRes.success) {
                        const label = promoteRes.isExistingClient
                            ? 'Member record updated and promoted.'
                            : 'Client created and promoted to pending.';
                        toast.success(`CI approved. ${label}`);
                    } else {
                        console.warn('[CI] Promote blocked:', promoteRes.message);
                        toast.warning(promoteRes.message || 'CI saved but promotion was blocked.');
                    }
                } catch (promoteErr) {
                    console.error('[CI] Promote error:', promoteErr);
                    toast.warning('CI saved. Promotion failed — please retry from the LAF tab.');
                }
                onSaved?.({ offline: false, investigation: res.investigation });
            } else {
                toast.success('Investigation saved. Application declined.');
                onSaved?.({ offline: false, investigation: res.investigation });
            }

        } catch (err) {
            toast.error(err.message || 'An error occurred.');
        } finally {
            setSaving(false);
        }
    }, [decision, declineReason, businessVerified, addressVerified,
        selfieFile, investigationData, ciQuestions,
        answers, isOnline, buildPayload, saveDraft, onSaved, application]);

    return (
        <div className="space-y-6">

            {/* Pending validation banner */}
            {application?.status === 'pending_validation' && (
                <div className="p-4 bg-orange-50 border border-orange-300 rounded-xl">
                    <p className="text-sm font-semibold text-orange-900">⏳ Awaiting Admin Validation</p>
                    <p className="text-xs text-orange-700 mt-1">
                        This application was flagged as a possible duplicate.
                        A system administrator must resolve the duplicate panel below
                        before this CI investigation can be saved.
                    </p>
                </div>
            )}

            {/* LAF photo */}
            {lafPhotoUrl && (
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Application Photo (LAF)
                    </p>
                    <img src={lafPhotoUrl} alt="Client LAF photo"
                        className="w-32 h-32 object-cover rounded-xl border" />
                </div>
            )}

            {/* CI Questions */}
            {ciQuestions.length > 0 ? (
                <div className="space-y-4">
                    <p className="text-sm font-semibold text-gray-700">Investigation Questions</p>
                    {investigationData?.ciAnswers?.length > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg
                            text-xs text-blue-700">
                            Previously saved answers pre-filled below. Update if needed.
                        </div>
                    )}
                    {ciQuestions.map((q, i) => (
                        <CIQuestion key={q.id} question={q} index={i}
                            answer={answers[q.id] || ''}
                            onChange={val => handleAnswerChange(q.id, val)} />
                    ))}
                </div>
            ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl
                    text-xs text-gray-500 text-center">
                    No CI questions configured. Add questions in System Settings → CI Questions.
                </div>
            )}

            {/* FIX: Verification checkboxes — required before saving */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Verification
                    <span className="ml-1 text-red-500 normal-case font-normal text-xs">
                        * both required
                    </span>
                </p>
                <div className="flex gap-3 flex-wrap">
                    {/* Business verified */}
                    <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5
                        rounded-xl border-2 transition-colors flex-1 min-w-[160px] ${
                        businessVerified
                            ? 'bg-green-50 border-green-400'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}>
                        <input type="checkbox" checked={businessVerified}
                            onChange={e => setBusinessVerified(e.target.checked)}
                            className="w-4 h-4 rounded text-green-600 flex-shrink-0" />
                        <span className={`text-sm font-medium ${
                            businessVerified ? 'text-green-700' : 'text-gray-700'
                        }`}>
                            Business verified
                        </span>
                        {businessVerified && (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
                        )}
                    </label>

                    {/* Address verified */}
                    <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5
                        rounded-xl border-2 transition-colors flex-1 min-w-[160px] ${
                        addressVerified
                            ? 'bg-green-50 border-green-400'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}>
                        <input type="checkbox" checked={addressVerified}
                            onChange={e => setAddressVerified(e.target.checked)}
                            className="w-4 h-4 rounded text-green-600 flex-shrink-0" />
                        <span className={`text-sm font-medium ${
                            addressVerified ? 'text-green-700' : 'text-gray-700'
                        }`}>
                            Address verified
                        </span>
                        {addressVerified && (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
                        )}
                    </label>
                </div>
                {/* Hint when either is unchecked */}
                {(!businessVerified || !addressVerified) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        Both must be confirmed before the investigation can be saved.
                    </p>
                )}
            </div>

            {/* Duplicate validation panel */}
            {(applicationData?.application?.isDuplicateFlagged ||
              applicationData?.application?.duplicateCandidateIds?.length > 0) && (
                <CIDuplicatePanel
                    application={applicationData.application}
                    onValidated={onSaved}
                />
            )}

            {/* Decision */}
            <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Decision *</p>
                <div className="flex gap-3">
                    <button type="button" onClick={() => setDecision('approved')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3
                            rounded-xl border-2 text-sm font-medium transition-colors ${
                            decision === 'approved'
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 text-gray-600 hover:border-green-300'
                        }`}>
                        <CheckCircle className="w-4 h-4" />
                        Approve
                    </button>
                    <button type="button" onClick={() => setDecision('declined')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3
                            rounded-xl border-2 text-sm font-medium transition-colors ${
                            decision === 'declined'
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 text-gray-600 hover:border-red-300'
                        }`}>
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
                    <textarea rows={3} value={declineReason}
                        onChange={e => setDeclineReason(e.target.value)}
                        placeholder="Explain why this application is being declined..."
                        className="w-full px-3 py-2.5 border border-red-300 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
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
                                        Offline — selfie will be stored locally and uploaded when you reconnect.
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {investigationData?.selfieUrl && !selfieFile && (
                        <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-2">Previously uploaded selfie:</p>
                            <button type="button"
                                onClick={() => {
                                    setPreviewUrl(investigationData.selfieUrl);
                                    setPreviewOpen(true);
                                }}
                                className="relative group rounded-xl overflow-hidden border
                                    border-gray-200 hover:border-blue-400 transition-colors block">
                                <img src={investigationData.selfieUrl} alt="CI selfie"
                                    className="w-28 h-28 object-cover" />
                                <div className="absolute inset-0 bg-black bg-opacity-0
                                    group-hover:bg-opacity-30 transition-all flex items-center
                                    justify-center">
                                    <svg className="w-6 h-6 text-white opacity-0
                                        group-hover:opacity-100 transition-opacity"
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/>
                                    </svg>
                                </div>
                            </button>
                        </div>
                    )}

                    {previewOpen && previewUrl && (
                        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-90
                            flex items-center justify-center p-4"
                            onClick={() => setPreviewOpen(false)}>
                            <button type="button" onClick={() => setPreviewOpen(false)}
                                className="absolute top-4 right-4 text-white bg-black
                                    bg-opacity-50 rounded-full p-2 hover:bg-opacity-70">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                        strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                            <img src={previewUrl} alt="CI selfie full view"
                                className="max-w-full max-h-full object-contain rounded-lg
                                    shadow-2xl"
                                onClick={e => e.stopPropagation()} />
                            <p className="absolute bottom-4 left-0 right-0 text-center
                                text-white text-xs opacity-50">
                                Tap anywhere outside to close
                            </p>
                        </div>
                    )}

                    <PhotoCapture onFileReady={setSelfieFile}
                        label="Take selfie with client and form"
                        facingMode="user" maxMB={10} />
                </div>
            )}

            {/* Save button */}
            <button type="button" onClick={handleSave}
                disabled={saving || !decision || application?.status === 'pending_validation'}
                className="w-full py-3 bg-blue-600 text-white text-sm font-semibold
                    rounded-xl hover:bg-blue-700 disabled:opacity-50
                    disabled:cursor-not-allowed flex items-center justify-center gap-2">
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