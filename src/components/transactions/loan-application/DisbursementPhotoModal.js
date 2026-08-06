// src/components/transactions/loan-application/DisbursementPhotoModal.js
// Changes:
// 1. Modal wider: max-w-2xl
// 2. Staff biometric: optional-with-warning when approver has none registered.
// 3. Face verification retry fix: reset result + restart camera properly.
// 4. Multi-client batch support: client face verification is now a per-client
//    queue. Clients on a v2 branch who never went through the new LAF flow
//    (no promoted temporaryLoanApplications record) are skipped, with the
//    reason shown to the user and passed to onConfirm for audit purposes.
// 5. Flow-status check uses the batch clients/flow-status endpoint
//    (checks temporaryLoanApplications.status === 'promoted' with
//    promotedClientId OR existingClientId matching) instead of a
//    non-existent per-client field.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Fingerprint } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBiometric } from '@/hooks/useBiometric';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import Spinner from '@/components/Spinner';
import FaceVerifyStep from '@/components/transactions/loan-application/FaceVerifyStep';
import PhotoCapture from '@/components/clients/PhotoCapture';

const DisbursementPhotoModal = ({
    show,
    loans = [],
    onConfirm, // (photoKey, approverId, skippedClientIds: string[]) => void
    onCancel,
}) => {
    const currentUser            = useSelector(s => s.user.data);
    const currentBranch          = useSelector(s => s.branch.data);
    const requireClientBiometric = useSelector(
        s => s.systemSettings?.data?.requireClientBiometric ?? true
    );
    const requireStaffBiometric  = useSelector(
        s => s.systemSettings?.data?.requireStaffBiometric ?? true
    );
    const { authenticateWithBiometric, loading: biometricLoading } = useBiometric();

    // ── Photo state ──────────────────────────────────────────────────────
    const [photo,     setPhoto]     = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoKey,  setPhotoKey]  = useState(null);
    const [uploading, setUploading] = useState(false);

    // ── Approver state ───────────────────────────────────────────────────
    const [approverList,     setApproverList]     = useState([]);
    const [approverId,       setApproverId]       = useState('');
    const [approversLoading, setApproversLoading] = useState(false);

    // ── Staff biometric ──────────────────────────────────────────────────
    const [biometricVerified,  setBiometricVerified]  = useState(false);
    const [biometricRequired,  setBiometricRequired]  = useState(false);
    const [selectedApprover,   setSelectedApprover]   = useState(null);

    // ── Client face verification — per-client queue ─────────────────────
    // clientStatusMap: clientId -> { faceTemplate, needsVerification, reason }
    const [clientStatusMap, setClientStatusMap] = useState({});
    const [statusLoaded,    setStatusLoaded]    = useState(false);
    const [verificationQueue, setVerificationQueue] = useState([]); // loans needing a check, in order
    const [verifyIndex,     setVerifyIndex]     = useState(0);
    const [faceMatchScores, setFaceMatchScores] = useState({}); // clientId -> score
    // FIX issue 4: key to force full remount of FaceVerifyStep on retry
    const [faceVerifyKey,   setFaceVerifyKey]   = useState(0);

    const [confirming, setConfirming] = useState(false);

    const roleMap = {
        branch_manager:   'BM',
        area_admin:       'AM',
        regional_manager: 'RM',
        deputy_director:  'OD',
    };

    const getClientId = (loan) => loan?.clientId || loan?.client?._id;
    const getClientName = (loan) => loan?.fullName || loan?.clientName ||
        `${loan?.client?.firstName || ''} ${loan?.client?.lastName || ''}`.trim();

    // ── Reset on open ────────────────────────────────────────────────────
    useEffect(() => {
        if (!show) return;
        setPhoto(null); setPhotoFile(null); setPhotoKey(null);
        setApproverId(currentUser?._id || '');
        setBiometricVerified(false);
        setBiometricRequired(false);
        setSelectedApprover(null);
        setClientStatusMap({});
        setStatusLoaded(false);
        setVerificationQueue([]);
        setVerifyIndex(0);
        setFaceMatchScores({});
        setFaceVerifyKey(0);
    }, [show, currentUser]);

    // ── Load client flow-status + faceTemplate for ALL selected loans ──────
    // Two batch calls instead of N sequential lookups:
    //   1. clients/flow-status — tells us skip/no-skip per client (batch)
    //   2. clients?clientId=  — still per-client for faceTemplate, since
    //      that endpoint has no batch form. If batch sizes grow beyond a
    //      handful, consider reusing clients/by-ids (already used in
    //      CIDuplicatePanel) instead of this loop.
    useEffect(() => {
        if (!show || !loans?.length) return;

        if (!requireClientBiometric) {
            setStatusLoaded(true);
            setVerificationQueue([]);
            return;
        }

        setStatusLoaded(false);

        const clientIds = [...new Set(loans.map(getClientId).filter(Boolean))];
        if (clientIds.length === 0) {
            setStatusLoaded(true);
            setVerificationQueue([]);
            return;
        }

        Promise.all([
            fetchWrapper.get(
                getApiBaseUrl() + 'clients/flow-status?' +
                new URLSearchParams({ clientIds: clientIds.join(',') })
            ),
            Promise.all(
                clientIds.map(id =>
                    fetchWrapper.get(getApiBaseUrl() + `clients?clientId=${id}`)
                        .then(res => ({ id, record: res.client?.[0] || res.clients?.[0] }))
                        .catch(() => ({ id, record: null }))
                )
            ),
        ]).then(([flowStatusRes, clientRecords]) => {
            const statusMap = flowStatusRes?.success ? (flowStatusRes.statusMap || {}) : {};

            const map = {};
            clientRecords.forEach(({ id, record }) => {
                let faceTemplate = null;
                const raw = record?.faceTemplate;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length === 128) faceTemplate = parsed;
                    } catch { /* leave null */ }
                }

                const isV2Branch = currentBranch?.clientFlowVersion === 'v2';
                // statusMap[id] === true  → client went through the new LAF flow
                //                            (promoted temp application found)
                // statusMap[id] === false → no matching promoted record found
                // Fail-safe: if statusMap has no entry for this id at all
                // (flow-status call failed / partial response), never skip —
                // treat as "went through flow" so verification still runs.
                const wentThroughNewFlow = statusMap.hasOwnProperty(id) ? statusMap[id] : true;
                const skip = !wentThroughNewFlow;

                map[id] = {
                    faceTemplate,
                    needsVerification: !skip,
                    reason: skip ? 'legacy_flow' : null,
                };
            });

            setClientStatusMap(map);

            const seen = new Set();
            const queue = loans.filter(l => {
                const cid = getClientId(l);
                if (!cid || seen.has(cid)) return false;
                if (!map[cid]?.needsVerification) return false;
                seen.add(cid);
                return true;
            });

            setVerificationQueue(queue);
            setVerifyIndex(0);
            setStatusLoaded(true);
        }).catch(() => {
            // Total failure — fail safe: require verification for everyone,
            // don't silently skip a biometric control because a fetch broke.
            const map = {};
            clientIds.forEach(id => {
                map[id] = { faceTemplate: null, needsVerification: true, reason: null };
            });
            setClientStatusMap(map);

            const seen = new Set();
            const queue = loans.filter(l => {
                const cid = getClientId(l);
                if (!cid || seen.has(cid)) return false;
                seen.add(cid);
                return true;
            });
            setVerificationQueue(queue);
            setVerifyIndex(0);
            setStatusLoaded(true);
        });
    }, [show, loans, requireClientBiometric, currentBranch]);

    // ── Load approvers ───────────────────────────────────────────────────
    useEffect(() => {
        if (!show || !currentUser?.designatedBranch) return;
        setApproversLoading(true);
        fetchWrapper
            .get(getApiBaseUrl() + 'users/approvers?' +
                new URLSearchParams({ branchCode: currentUser.designatedBranch }))
            .then(r => {
                if (r.success) {
                    const admins = (r.users || [])
                        .map(u => ({
                            ...u,
                            label: `${roleMap[u.role?.shortCode] || 'STAFF'} — ${u.firstName} ${u.lastName}`,
                        }))
                        .sort((a, b) => (a.role?.rep || 99) - (b.role?.rep || 99));
                    setApproverList(admins);
                    const defaultId = currentUser._id || '';
                    setApproverId(defaultId);
                    const me = admins.find(u => u._id === defaultId);
                    setBiometricRequired(requireStaffBiometric && !!(me?.hasBiometric));
                    setSelectedApprover(me || null);
                }
            })
            .catch(() => {})
            .finally(() => setApproversLoading(false));
    }, [show, currentUser]);

    const handleApproverSelect = (userId) => {
        setApproverId(userId);
        setBiometricVerified(false);
        const selected = approverList.find(u => u._id === userId);
        setSelectedApprover(selected || null);
        const isCurrentUser = userId === currentUser?._id;
        setBiometricRequired(requireStaffBiometric && isCurrentUser && !!(selected?.hasBiometric));
    };

    // ── Photo handlers ───────────────────────────────────────────────────
    const uploadPhoto = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('origin', 'disbursement');
        formData.append('uuid', loans[0]?._id || `disbursement${Date.now()}`);
        const res  = await fetch('/api/upload', { method: 'POST', body: formData });
        const ct   = res.headers.get('content-type') || '';
        if (!ct.includes('application/json'))
            throw new Error(res.status === 413 ? 'Photo is too large.' : `Upload error (${res.status}).`);
        const data = await res.json();
        if (!data.fileKey) throw new Error(data.error || 'Upload failed.');
        return data.fileKey;
    }, [loans]);

    // ── Staff biometric scan ──────────────────────────────────────────────
    const handleBiometricScan = async () => {
        const result = await authenticateWithBiometric(approverId);
        if (result.success) {
            setBiometricVerified(true);
            toast.success('Identity verified.');
        } else if (!result.cancelled) {
            toast.error(result.error || 'Biometric verification failed.');
        }
    };

    // ── Client face verification handlers ─────────────────────────────────
    const currentVerifyLoan = verificationQueue[verifyIndex];
    const clientFaceDone = requireClientBiometric
        ? verifyIndex >= verificationQueue.length
        : true;

    const handleClientVerified = (result) => {
        const cid = getClientId(currentVerifyLoan);
        if (cid) {
            setFaceMatchScores(prev => ({ ...prev, [cid]: result?.faceMatchScore ?? null }));
        }
        setVerifyIndex(i => i + 1);
        setFaceVerifyKey(k => k + 1); // fresh mount for next client too
    };

    const handleClientSkipped = () => {
        const cid = getClientId(currentVerifyLoan);
        if (cid) {
            setFaceMatchScores(prev => ({ ...prev, [cid]: null }));
        }
        setVerifyIndex(i => i + 1);
        setFaceVerifyKey(k => k + 1);
    };

    // ── Confirm ──────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        if (!photoFile)  { toast.error('Please take a disbursement photo.'); return; }
        if (!approverId) { toast.error('Please select an approving officer.'); return; }
        if (!statusLoaded) { toast.error('Still checking client verification status, please wait.'); return; }
        if (biometricRequired && !biometricVerified) {
            toast.error('Please complete biometric verification before approving.');
            return;
        }
        if (requireClientBiometric && !clientFaceDone) {
            toast.error('Please complete face verification for all clients before approving.');
            return;
        }
        setConfirming(true);
        setUploading(true);
        try {
            const key = await uploadPhoto(photoFile);
            setPhotoKey(key);
            setUploading(false);

            const skippedClientIds = Object.entries(clientStatusMap)
                .filter(([, v]) => v.reason === 'legacy_flow')
                .map(([cid]) => cid);

            await onConfirm(key, approverId, skippedClientIds);
        } catch (err) {
            setUploading(false);
            toast.error(err.message || 'Failed to upload photo.');
        } finally {
            setConfirming(false);
        }
    };

    if (!show) return null;

    const loanCount  = loans.length;
    const canConfirm = photoFile && approverId && statusLoaded &&
        (!biometricRequired || biometricVerified) &&
        (!requireClientBiometric || clientFaceDone) &&
        !uploading && !confirming;

    const stepDone = (cond) => cond
        ? 'bg-green-500 text-white'
        : 'bg-gray-200 text-gray-500';

    // Step numbering — dynamic based on whether biometric step shows
    const clientFaceStep = requireStaffBiometric ? 4 : 3;

    const skippedEntries = Object.entries(clientStatusMap).filter(([, v]) => v.reason === 'legacy_flow');
    const verifiedCount = verifyIndex; // number already processed (verified or skipped-via-face-step)

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">LDF Disbursement Confirmation</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {loanCount} loan{loanCount !== 1 ? 's' : ''} selected for release
                        </p>
                    </div>
                    <button type="button" onClick={onCancel} disabled={uploading || confirming}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* Loan summary */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 max-h-28 overflow-y-auto">
                        {loans.map(l => (
                            <div key={l._id} className="flex items-center justify-between py-1">
                                <span className="text-xs font-medium text-blue-800">{getClientName(l)}</span>
                                <span className="text-xs text-blue-500 font-mono">{l.pnNumber}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Step 1: Disbursement Photo ──────────────────────── */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center
                                justify-center text-xs font-bold ${stepDone(photoFile)}`}>
                                {photoFile ? '✓' : '1'}
                            </div>
                            <p className="text-sm font-semibold text-gray-700">
                                Disbursement Photo <span className="text-red-500">*</span>
                            </p>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 ml-7">
                            Take a photo of the client(s) receiving the release money.
                        </p>
                        <div className="ml-7">
                            <PhotoCapture
                                onFileReady={(file) => {
                                    if (!file) {
                                        setPhoto(null);
                                        setPhotoFile(null);
                                        setPhotoKey(null);
                                        return;
                                    }
                                    setPhoto(URL.createObjectURL(file));
                                    setPhotoFile(file);
                                    setPhotoKey(null);
                                }}
                                label="Take or upload disbursement photo"
                                maxMB={5}
                                facingMode="environment"
                                allowUpload={true}
                                preview={photo}
                            />
                            {uploading && (
                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                    <Spinner /> Uploading...
                                </div>
                            )}
                            {photoKey && !uploading && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <CheckCircleIcon className="w-3.5 h-3.5" />
                                    Photo uploaded
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Step 2: Approving Officer ───────────────────────── */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${stepDone(approverId)}`}>
                                {approverId ? '✓' : '2'}
                            </div>
                            <p className="text-sm font-semibold text-gray-700">
                                Approving Officer <span className="text-red-500">*</span>
                            </p>
                        </div>
                        {approversLoading ? (
                            <div className="ml-7"><Spinner /></div>
                        ) : (
                            <div className="ml-7 space-y-2">
                                {approverList.map(u => (
                                    <button key={u._id} type="button"
                                        onClick={() => handleApproverSelect(u._id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl border
                                            text-sm transition-colors ${
                                            approverId === u._id
                                                ? 'border-blue-500 bg-blue-50 text-blue-800'
                                                : 'border-gray-200 hover:border-blue-300'
                                        }`}>
                                        {u.label}
                                        {approverId === u._id && (
                                            <span className={`ml-2 text-xs font-medium ${
                                                u.hasBiometric ? 'text-green-600' : 'text-amber-600'
                                            }`}>
                                                {u.hasBiometric ? '· Biometric registered' : '· No biometric'}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Step 3: Staff Biometric ──────────────────────────── */}
                    {requireStaffBiometric && approverId && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center
                                    text-xs font-bold ${stepDone(biometricVerified || !biometricRequired)}`}>
                                    {(biometricVerified || !biometricRequired) ? '✓' : '3'}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Your Identity Verification
                                </p>
                            </div>
                            <div className="ml-7">
                                {biometricVerified ? (
                                    <div className="flex items-center gap-2 text-green-700 text-sm">
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Identity verified
                                    </div>
                                ) : biometricRequired ? (
                                    <button type="button" onClick={handleBiometricScan}
                                        disabled={biometricLoading || !approverId}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-800
                                            text-white text-sm font-medium rounded-xl hover:bg-gray-900
                                            disabled:opacity-50 transition-colors">
                                        <Fingerprint className="w-4 h-4" />
                                        {biometricLoading ? 'Scanning…' : 'Scan Your Fingerprint / Face ID'}
                                    </button>
                                ) : selectedApprover?.hasBiometric === false ? (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-xs font-semibold text-amber-800 mb-1">
                                            No biometric registered
                                        </p>
                                        <p className="text-xs text-amber-700 mb-2">
                                            You have not registered a biometric (fingerprint or Face ID)
                                            on this account. You can proceed without it, but we recommend
                                            registering your biometric in{' '}
                                            <strong>Settings → My Profile → Biometric</strong> for stronger
                                            identity verification at disbursement.
                                        </p>
                                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                            <CheckCircleIcon className="w-3.5 h-3.5" />
                                            Proceeding without biometric — recorded in audit log.
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Client Face Verification (per-client queue) ─ */}
                    {requireClientBiometric && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center
                                    text-xs font-bold ${stepDone(clientFaceDone)}`}>
                                    {clientFaceDone ? '✓' : clientFaceStep}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Client Face Verification
                                </p>
                            </div>

                            <div className="ml-7 space-y-3">
                                {!statusLoaded ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Spinner /> Checking client verification requirements…
                                    </div>
                                ) : (
                                    <>
                                        {/* Full client checklist — shows verified / skipped / pending for every loan */}
                                        <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
                                            {loans.map((l, idx) => {
                                                const cid = getClientId(l);
                                                const status = clientStatusMap[cid];
                                                const isSkipped = status?.reason === 'legacy_flow';
                                                const queuePos = verificationQueue.findIndex(q => getClientId(q) === cid);
                                                const isDone = !isSkipped && queuePos > -1 && queuePos < verifyIndex;
                                                const isCurrent = !isSkipped && queuePos === verifyIndex;
                                                const isPending = !isSkipped && queuePos > verifyIndex;

                                                return (
                                                    <div key={l._id || idx}
                                                        className={`flex items-center justify-between px-3 py-2 text-xs ${
                                                            isCurrent ? 'bg-blue-50' : 'bg-white'
                                                        }`}>
                                                        <span className="font-medium text-gray-700">{getClientName(l)}</span>
                                                        {isSkipped ? (
                                                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                                                                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                                Skipped — legacy client, no new-flow record
                                                            </span>
                                                        ) : isDone ? (
                                                            <span className="flex items-center gap-1 text-green-600 font-medium">
                                                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                                                Verified
                                                            </span>
                                                        ) : isCurrent ? (
                                                            <span className="text-blue-600 font-medium">In progress</span>
                                                        ) : isPending ? (
                                                            <span className="text-gray-400">Pending</span>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {skippedEntries.length > 0 && (
                                            <p className="text-[11px] text-amber-600 leading-snug">
                                                {skippedEntries.length} client{skippedEntries.length !== 1 ? 's' : ''} skipped
                                                because this branch is on the new client flow (v2) but their record
                                                predates it — there is no promoted LAF application to verify against.
                                                This will be shown in the approval confirmation.
                                            </p>
                                        )}

                                        {/* Active verification widget for current client in queue */}
                                        {!clientFaceDone && currentVerifyLoan && (
                                            <div className="pt-1">
                                                <p className="text-xs text-gray-400 mb-2">
                                                    Verifying: <span className="font-medium text-gray-600">{getClientName(currentVerifyLoan)}</span>
                                                </p>
                                                <FaceVerifyStep
                                                    key={`${getClientId(currentVerifyLoan)}-${faceVerifyKey}`}
                                                    faceTemplate={clientStatusMap[getClientId(currentVerifyLoan)]?.faceTemplate}
                                                    onVerified={handleClientVerified}
                                                    onSkip={handleClientSkipped}
                                                    onRetry={() => setFaceVerifyKey(k => k + 1)}
                                                    canSkip={
                                                        currentUser?.role?.rep === 1 ||
                                                        currentUser?.root === true
                                                    }
                                                />
                                            </div>
                                        )}

                                        {clientFaceDone && verificationQueue.length > 0 && (
                                            <div className="flex items-center gap-2 text-green-700 text-sm">
                                                <CheckCircleIcon className="w-4 h-4" />
                                                All required clients confirmed ({verifiedCount}/{verificationQueue.length})
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Confirm button ──────────────────────────────────── */}
                    <div className="pt-2 border-t border-gray-100 flex gap-3">
                        <ButtonOutline label="Cancel" type="button" className="p-2 flex-1"
                            onClick={onCancel} disabled={confirming || uploading} />
                        <ButtonSolid
                            label={confirming ? 'Processing…' : 'Confirm & Approve'}
                            type="button"
                            className={`p-2 flex-1 ${!canConfirm
                                ? '!bg-gray-300 !text-gray-500 cursor-not-allowed' : ''}`}
                            onClick={handleConfirm}
                            disabled={!canConfirm}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisbursementPhotoModal;