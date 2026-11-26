// src/components/ci/CIReviewPanel.js
// FIX: businessVerified and addressVerified are now required before saving
// FIX: Checkboxes show visual confirmed state with green styling + checkmark

import React, { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import PhotoCapture from '@/components/clients/PhotoCapture';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useCIDraftStorage } from '@/hooks/useCIDraftStorage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { checkRealConnectivity } from '@/lib/check-online';
import FaceLivenessStep from '@/components/laf/FaceLivenessStep';
import { canInvestigateCI } from '@/lib/ci-roles';

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

const CIQuestion = ({ question, index, answer, onChange, requiredActive = true }) => (
    <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
            {index + 1}. {question.question}
            {question.required && requiredActive && <span className="ml-1 text-red-500 text-xs">*</span>}
            {(!question.required || !requiredActive) && <span className="ml-1 text-gray-400 text-xs font-normal">(optional)</span>}
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

const CIReviewPanel = ({ applicationData, investigationData, onSaved, onGoToDuplicateTab }) => {
    const currentUser    = useSelector(state => state.user.data);
    const systemSettings = useSelector(state => state.systemSettings.data);
    const { isOnline }   = useOnlineStatus();
    const { saveDraft }  = useCIDraftStorage();
    const canDecide      = canInvestigateCI(currentUser, systemSettings?.allowLoCI === true);

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
    // Upload is allowed only when the application's branch is in offline mode. Fails closed
    // (live camera only) until the server confirms, and if the lookup fails or we are offline.
    const [branchOfflineMode, setBranchOfflineMode] = useState(false);
    const ciBranchId = application?.branchId;
    useEffect(() => {
        setBranchOfflineMode(false);
        if (!ciBranchId || !isOnline) return undefined;
        let cancelled = false;
        fetchWrapper.get(
            getApiBaseUrl() + 'branches/face-verify-mode?' + new URLSearchParams({ branchIds: ciBranchId })
        )
            .then(res => { if (!cancelled) setBranchOfflineMode(res?.success && res.modeMap?.[ciBranchId] === true); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [ciBranchId, isOnline]);
    const [saving,           setSaving]           = useState(false);
    // Promotion blocked by the duplicate-client guard: { matches, canOverride, investigation }
    const [dupBlock,         setDupBlock]         = useState(null);
    const [overrideReason,   setOverrideReason]   = useState('');
    const [overriding,       setOverriding]       = useState(false);
    const [previewOpen,      setPreviewOpen]      = useState(false);
    const [previewUrl,       setPreviewUrl]       = useState(null);
    const [faceCapture, setFaceCapture] = useState(null); // { faceTemplate, livenessScore } once captured
    const [leaderCheckLoading, setLeaderCheckLoading] = useState(false);
    const [leaderConfirmOpen,  setLeaderConfirmOpen]  = useState(false);
    const [existingLeaderInfo, setExistingLeaderInfo] = useState(null); // { firstName, lastName } or null

    // Application was queued offline and never got its face template captured
    // at submission time — needs enrollment now, before promotion, if we have
    // connectivity to do it. If still offline, defer further to disbursement.
    // Kept separate from the render condition below so the success state (once
    // captured) actually stays visible instead of the block vanishing the
    // instant faceCapture is set.
    const needsFaceEnrollment = !!application?.isOffline
        && !(application?.hasFaceTemplate ?? application?.faceTemplate);
    const faceEnrollmentBlocking = needsFaceEnrollment && !faceCapture; // still gates Save

    const [existingClientGroupLeader, setExistingClientGroupLeader] = useState(null);

    useEffect(() => {
        if (!application?.existingClientId) return;
        fetchWrapper.post(getApiBaseUrl() + 'clients/by-ids', {
            ids: [application.existingClientId],
            ciReferenceCode: application.ciReferenceCode,
        }).then(res => {
            const c = res?.clients?.[0] || null;
            if (c) setExistingClientGroupLeader({ groupLeader: !!c.groupLeader, status: c.status });
        })
        .catch(() => {});
    }, [application?.existingClientId]);

    const [groupLeader, setGroupLeader] = useState(
        investigationData?.groupLeader ?? application?.groupLeader ?? false
    );

    useEffect(() => {
        if (existingClientGroupLeader?.status === 'active' && existingClientGroupLeader?.groupLeader) {
            setGroupLeader(true);
        }
    }, [existingClientGroupLeader]);

    const handleGroupLeaderToggle = useCallback(async (nextValue) => {
        if (!nextValue) {
            // Turning OFF never needs a confirmation.
            setGroupLeader(false);
            return;
        }

        if (!application?.groupId) {
            // No group context yet (shouldn't normally happen at CI-review stage) — just set it.
            setGroupLeader(true);
            return;
        }

        setLeaderCheckLoading(true);
        try {
            const excludeClientId = application?.existingClientId || application?.promotedClientId || '';
            const params = new URLSearchParams({ groupId: application.groupId });
            if (excludeClientId) params.set('excludeClientId', excludeClientId);

            const res = await fetchWrapper.get(getApiBaseUrl() + `laf/group-leader-check?${params}`);
            if (res.success && res.hasExistingLeader) {
                setExistingLeaderInfo(res.existingLeaders[0] || null);
                setLeaderConfirmOpen(true); // don't set groupLeader yet — wait for confirm
            } else {
                setGroupLeader(true);
            }
        } catch {
            // Fail open with a warning rather than silently blocking the toggle —
            // matches the fail-open pattern used elsewhere in this file (e.g. ID dup check).
            toast.warning('Could not verify existing group leader — proceeding anyway.');
            setGroupLeader(true);
        } finally {
            setLeaderCheckLoading(false);
        }
    }, [application]);

    const confirmSetGroupLeader = () => {
        setGroupLeader(true);
        setLeaderConfirmOpen(false);
        setExistingLeaderInfo(null);
    };

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
        groupLeader,
    }), [application, businessVerified, addressVerified, decision, declineReason, groupLeader, buildCiAnswers]);

    const handleSave = useCallback(async () => {
        if (!canDecide) {
            toast.error('Your role is not allowed to approve or decline a CI investigation.');
            return;
        }
        if (application?.status === 'pending_validation') {
            toast.error('This application requires admin duplicate validation before CI can be saved.');
            return;
        }
        if (!decision) { toast.error('Please select Approve or Decline.'); return; }

        // Verification and required questions apply only when approving.
        if (decision === 'approved' && !businessVerified) {
            toast.error('Please confirm that the business has been verified.');
            return;
        }
        if (decision === 'approved' && !addressVerified) {
            toast.error('Please confirm that the address has been verified.');
            return;
        }

        const unanswered = decision === 'approved'
            ? ciQuestions.filter(q => q.required && !answers[q.id]?.trim())
            : [];
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

        if (decision === 'approved' && isOnline && faceEnrollmentBlocking) {
            toast.error('Please complete face enrollment for this client before approving — see below.');
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

            if (faceCapture) {
                try {
                    await fetchWrapper.post(getApiBaseUrl() + 'laf/enroll-face', {
                        ciReferenceCode: application.ciReferenceCode,
                        faceTemplate:    faceCapture.faceTemplate,
                        faceEnrolledAt:  faceCapture.faceEnrolledAt,
                        livenessScore:   faceCapture.livenessScore,
                    });
                } catch (err) {
                    toast.error('Face enrollment failed to save — please try again.');
                    setSaving(false);
                    return;
                }
            }

            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/ci/investigate', buildPayload(selfieKey)
            );
            if (!res.success) throw new Error(res.message || 'Save failed.');

            // ── Auto-promote after CI approval ────────────────────────────
            if (decision === 'approved') {
                try {
                    const promoteRes = await fetchWrapper.post(
                        getApiBaseUrl() + `laf/promote/${encodeURIComponent(application.ciReferenceCode)}`
                    );
                    if (promoteRes.success) {
                        const label = promoteRes.isExistingClient
                            ? 'Member record updated and promoted.'
                            : 'Client created and promoted to pending.';
                        toast.success(`CI approved. ${label}`);
                    } else if (promoteRes.code === 'DUPLICATE_CLIENT_BLOCKED') {
                        // Keep the panel open so the reviewer can read the matches / override. onSaved fires after they decide.
                        setOverrideReason('');
                        setDupBlock({ matches: promoteRes.matches ?? [], canOverride: !!promoteRes.canOverride, investigation: res.investigation });
                        return;
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
        selfieFile, investigationData, ciQuestions, needsFaceEnrollment, faceCapture,
        answers, isOnline, buildPayload, saveDraft, onSaved, application, canDecide]);

    const closeDupBlock = () => {
        const inv = dupBlock?.investigation;
        setDupBlock(null);
        onSaved?.({ offline: false, investigation: inv });
    };

    const overridePromote = async () => {
        if (overrideReason.trim().length < 10) {
            toast.error('Enter a reason of at least 10 characters.');
            return;
        }
        setOverriding(true);
        try {
            const r = await fetchWrapper.post(
                getApiBaseUrl() + `laf/promote/${encodeURIComponent(application.ciReferenceCode)}`,
                { overrideDuplicate: true, overrideReason: overrideReason.trim() }
            );
            if (r.success) {
                toast.success('Promoted with duplicate override (recorded in the audit log).');
                closeDupBlock();
            } else {
                toast.error(r.message || 'Promotion failed.');
            }
        } catch (e) {
            toast.error(e.message || 'Promotion failed.');
        } finally {
            setOverriding(false);
        }
    };

    return (
        <div className="space-y-6">

            {dupBlock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black bg-opacity-40" />
                    <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <h3 className="font-bold text-gray-900">Possible duplicate client</h3>
                        </div>
                        <p className="text-sm text-gray-700">
                            The CI was saved, but this person matches an existing client with an active or pending loan, so a new client was not created.
                        </p>
                        <ul className="divide-y divide-gray-100 border border-red-200 rounded-lg text-sm">
                            {dupBlock.matches.map(m => (
                                <li key={m.clientId} className="px-3 py-2">
                                    <p className="font-medium text-gray-900">{m.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {[m.branchName, m.birthdate, m.hasActiveLoan ? 'Active loan' : m.hasPendingLoan ? 'Pending loan' : null].filter(Boolean).join(' · ')}
                                    </p>
                                    <p className="text-xs text-red-600">{(m.reasons ?? []).join('; ')}</p>
                                </li>
                            ))}
                        </ul>
                        {dupBlock.canOverride ? (
                            <>
                                <label className="block text-xs font-medium text-gray-700">
                                    If this is a different person, enter the reason (recorded in the audit log)
                                </label>
                                <textarea rows={3} value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
                            </>
                        ) : (
                            <p className="text-xs text-gray-500">Only a supervisor or admin can override. Ask them, or link the application to the existing client.</p>
                        )}
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={closeDupBlock} disabled={overriding}
                                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Close without promoting</button>
                            {dupBlock.canOverride && (
                                <button type="button" onClick={overridePromote} disabled={overriding}
                                    className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                                    {overriding ? 'Promoting…' : 'Promote anyway'}
                                </button>
                            )}
                        </div>
                    </div>
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
                            requiredActive={decision !== 'declined'}
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
                    {decision === 'declined' ? (
                        <span className="ml-1 text-gray-400 normal-case font-normal text-xs">(optional when declining)</span>
                    ) : (
                        <span className="ml-1 text-red-500 normal-case font-normal text-xs">* both required</span>
                    )}
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
                {decision !== 'declined' && (!businessVerified || !addressVerified) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        Both must be confirmed before the investigation can be saved.
                    </p>
                )}
            </div>

            {/* Locked — duplicate resolution now happens exclusively in the
                "Flagged as Duplicate" tab, not inline here. */}
            {application?.status === 'pending_validation' && (
                <div className="p-4 bg-orange-50 border border-orange-300 rounded-xl">
                    <p className="text-sm font-semibold text-orange-900">
                        ⏳ This application is flagged as a possible duplicate
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                        It must be resolved in the <strong>Flagged as Duplicate</strong> tab before
                        this investigation can be saved or approved.
                    </p>
                    {onGoToDuplicateTab && (
                        <button type="button" onClick={onGoToDuplicateTab}
                            className="mt-3 px-4 py-2 bg-orange-600 text-white text-xs font-semibold
                                rounded-lg hover:bg-orange-700 transition-colors">
                            Go to Flagged as Duplicate →
                        </button>
                    )}
                </div>
            )}

            {/* Group Leader */}
            <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-xl">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">👑 Group Leader</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Group leaders must meet a higher minimum initial MCBU when their loan is created.
                        </p>
                    </div>
                    <button type="button"
                        disabled={leaderCheckLoading}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                            border-2 flex-shrink-0 disabled:opacity-50 ${
                            groupLeader ? 'bg-blue-500 border-blue-600' : 'bg-gray-200 border-gray-300'
                        }`}
                        onClick={() => handleGroupLeaderToggle(!groupLeader)}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm ${
                            groupLeader ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
                {leaderCheckLoading && (
                    <p className="text-xs text-blue-600 mt-2">Checking existing group leader…</p>
                )}
            </div>

            {/* Group leader confirmation modal */}
            {leaderConfirmOpen && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-5 max-w-sm w-full space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Group already has a leader</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    {existingLeaderInfo
                                        ? `${existingLeaderInfo.lastName}, ${existingLeaderInfo.firstName} is already the group leader for this group.`
                                        : 'This group already has an active or pending group leader.'}
                                    {' '}Setting this client as group leader too will not remove that status from
                                    the existing leader — both will be marked as group leader.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setLeaderConfirmOpen(false)}
                                className="flex-1 py-2 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="button" onClick={confirmSetGroupLeader}
                                className="flex-1 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
                                Set as Group Leader Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!canDecide && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    Your role can view this investigation but cannot approve or decline it.
                </div>
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

            {needsFaceEnrollment && decision === 'approved' && (
                isOnline ? (
                    <div>
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-3">
                            <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-blue-800">
                                    {faceCapture ? 'Face enrollment complete' : 'Face enrollment required'}
                                </p>
                                <p className="text-xs text-blue-600 mt-0.5">
                                    {faceCapture
                                        ? 'The client\'s face has been captured and will be saved when you submit this investigation.'
                                        : 'This application was submitted offline, so the client\'s face was never captured. Complete it now before approving — this must happen while you\'re online.'}
                                </p>
                            </div>
                        </div>
                        <FaceLivenessStep
                            onVerified={(data) => setFaceCapture(data)}
                            verified={!!faceCapture}
                        />
                    </div>
                ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                        You're currently offline — face enrollment will be deferred to disbursement instead.
                    </div>
                )
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
                        facingMode="user" maxMB={10}
                        allowUpload={branchOfflineMode}
                        enforceCamera={!branchOfflineMode} />
                </div>
            )}

            {/* Save button */}
            <button type="button" onClick={handleSave}
                disabled={saving || !decision || !canDecide || application?.status === 'pending_validation'}
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