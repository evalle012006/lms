// src/components/transactions/loan-application/DisbursementPhotoModal.js
// Phase 6 update — client biometric step:
//   • FIX: replaced QR-based WebAuthn client biometric with FaceVerifyStep
//     (face-api.js liveness detection + descriptor matching against stored faceTemplate)
//   • Staff approver biometric (WebAuthn) unchanged
//   • If requireClientBiometric = false → skip client face verification entirely

import React, { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { useSelector } from 'react-redux';
import { CameraIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Fingerprint } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBiometric } from '@/hooks/useBiometric';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import Spinner from '@/components/Spinner';
// FIX: import FaceVerifyStep — replaces QR biometric client verification
import FaceVerifyStep from '@/components/transactions/loan-application/FaceVerifyStep';

const DisbursementPhotoModal = ({
    show,
    loans = [],
    onConfirm,  // (photoKey, approverId) => void
    onCancel,
}) => {
    const currentUser            = useSelector(s => s.user.data);
    const requireClientBiometric = useSelector(
        s => s.systemSettings?.data?.requireClientBiometric ?? true
    );
    const { authenticateWithBiometric, loading: biometricLoading } = useBiometric();

    const fileInputRef = useRef();

    // ── Photo state ──────────────────────────────────────────────────────
    const [photo,     setPhoto]     = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoKey,  setPhotoKey]  = useState(null);
    const [uploading, setUploading] = useState(false);

    // ── Approver state ───────────────────────────────────────────────────
    const [approverList,     setApproverList]     = useState([]);
    const [approverId,       setApproverId]       = useState('');
    const [approversLoading, setApproversLoading] = useState(false);

    // ── Staff biometric (approver verification) ──────────────────────────
    const [biometricVerified, setBiometricVerified] = useState(false);
    const [biometricRequired, setBiometricRequired] = useState(false);

    // ── FIX: Client face verification state ──────────────────────────────
    // Replaces: clientBioMode, clientQrUrl, clientQrDataUrl, clientBioLoading,
    //           polling, pollRef, regTokenClientId
    // Now uses FaceVerifyStep with stored faceTemplate from client record
    const [clientVerified,     setClientVerified]     = useState(false);
    const [faceMatchScore,     setFaceMatchScore]     = useState(null);
    const [clientFaceTemplate, setClientFaceTemplate] = useState(null);

    const [confirming, setConfirming] = useState(false);

    const roleMap = {
        branch_manager:   'BM',
        area_admin:       'AM',
        regional_manager: 'RM',
        deputy_director:  'OD',
    };

    // ── FIX: Reset on open — simplified, no QR/polling state ────────────
    useEffect(() => {
        if (!show) return;
        setPhoto(null); setPhotoFile(null); setPhotoKey(null);
        setApproverId(currentUser?._id || '');
        setBiometricVerified(false); setBiometricRequired(false);
        setClientVerified(false);
        setClientFaceTemplate(null);
        setFaceMatchScore(null);
    }, [show, currentUser]);

    // ── FIX: Load client faceTemplate when modal opens ───────────────────
    // Previously: checked WebAuthn biometric status → generated QR → polled
    // Now: fetches client record → parses faceTemplate JSON → passes to FaceVerifyStep
    useEffect(() => {
        if (!show || !loans?.length || !requireClientBiometric) return;
        const firstLoan = loans[0];
        const clientId  = firstLoan.clientId || firstLoan.client?._id;
        if (!clientId) return;

        fetchWrapper.get(getApiBaseUrl() + `clients?clientId=${clientId}`)
            .then(res => {
                // API returns client data in various shapes — handle both
                const clientRecord = res.client?.[0] || res.clients?.[0];
                const raw = clientRecord?.faceTemplate;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length === 128) {
                            setClientFaceTemplate(parsed);
                        } else {
                            setClientFaceTemplate(null);
                        }
                    } catch {
                        setClientFaceTemplate(null);
                    }
                } else {
                    setClientFaceTemplate(null);
                }
            })
            .catch(() => setClientFaceTemplate(null));
    }, [show, loans, requireClientBiometric]);

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
                    setBiometricRequired(!!(me?.hasBiometric));
                }
            })
            .catch(() => {})
            .finally(() => setApproversLoading(false));
    }, [show, currentUser]);

    const handleApproverSelect = (userId) => {
        setApproverId(userId);
        setBiometricVerified(false);
        const selected = approverList.find(u => u._id === userId);
        const isCurrentUser = userId === currentUser?._id;
        setBiometricRequired(isCurrentUser && !!(selected?.hasBiometric));
    };

    // ── Photo handlers ───────────────────────────────────────────────────
    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB.'); return; }
        setPhoto(URL.createObjectURL(file));
        setPhotoFile(file);
        setPhotoKey(null);
    }, []);

    const uploadPhoto = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('origin', 'disbursement');
        formData.append('uuid', loans[0]?._id || `disbursement${Date.now()}`);
        const res  = await fetch('/api/upload', { method: 'POST', body: formData });
        const ct   = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error(res.status === 413 ? 'Photo is too large.' : `Upload error (${res.status}).`);
        const data = await res.json();
        if (!data.fileKey) throw new Error(data.error || 'Upload failed.');
        return data.fileKey;
    }, [loans]);

    // ── Staff biometric scan (WebAuthn — unchanged) ──────────────────────
    const handleBiometricScan = async () => {
        const result = await authenticateWithBiometric(approverId);
        if (result.success) {
            setBiometricVerified(true);
            toast.success('Identity verified.');
        } else if (!result.cancelled) {
            toast.error(result.error || 'Biometric verification failed.');
        }
    };

    // ── Confirm ──────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        if (!photoFile)  { toast.error('Please take a disbursement photo.'); return; }
        if (!approverId) { toast.error('Please select an approving officer.'); return; }
        if (biometricRequired && !biometricVerified) {
            toast.error('Please complete biometric verification before approving.');
            return;
        }
        if (requireClientBiometric && !clientVerified) {
            toast.error('Please complete client face verification before approving.');
            return;
        }
        setConfirming(true);
        setUploading(true);
        try {
            const key = await uploadPhoto(photoFile);
            setPhotoKey(key);
            setUploading(false);
            await onConfirm(key, approverId);
        } catch (err) {
            setUploading(false);
            toast.error(err.message || 'Failed to upload photo.');
        } finally {
            setConfirming(false);
        }
    };

    if (!show) return null;

    const loanCount  = loans.length;
    const canConfirm = photoFile && approverId &&
        (!biometricRequired || biometricVerified) &&
        (!requireClientBiometric || clientVerified) &&
        !uploading && !confirming;

    const stepDone = (cond) => cond
        ? 'bg-green-500 text-white'
        : 'bg-gray-200 text-gray-500';

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

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
                                <span className="text-xs font-medium text-blue-800">{l.fullName || l.clientName}</span>
                                <span className="text-xs text-blue-500 font-mono">{l.pnNumber}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Step 1: Disbursement Photo ──────────────────────── */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${stepDone(photoFile)}`}>
                                {photoFile ? '✓' : '1'}
                            </div>
                            <p className="text-sm font-semibold text-gray-700">Disbursement Photo <span className="text-red-500">*</span></p>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 ml-7">Take a photo of the client(s) receiving the release money.</p>
                        {photo ? (
                            <div className="relative ml-7">
                                <img src={photo} alt="Disbursement" className="w-full h-44 object-cover rounded-xl border border-gray-200" />
                                {uploading && (
                                    <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-xl">
                                        <Spinner />
                                    </div>
                                )}
                                {photoKey && !uploading && (
                                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                                        <CheckCircleIcon className="w-4 h-4" />
                                    </div>
                                )}
                                <button type="button" onClick={() => { setPhoto(null); setPhotoFile(null); setPhotoKey(null); }}
                                    disabled={uploading} className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 underline">
                                    Remove photo
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                className="ml-7 w-[calc(100%-1.75rem)] h-32 border-2 border-dashed border-gray-200 rounded-xl
                                    flex flex-col items-center justify-center gap-2 hover:border-teal-400 hover:bg-teal-50
                                    transition-colors disabled:opacity-50">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                    <CameraIcon className="w-5 h-5 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-500">Tap to upload photo</p>
                                <p className="text-xs text-gray-300">JPG, PNG · Max 5MB</p>
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                            onChange={handleFileChange} className="hidden" />
                    </div>

                    {/* ── Step 2: Approving Officer ───────────────────────── */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${stepDone(approverId)}`}>
                                {approverId ? '✓' : '2'}
                            </div>
                            <p className="text-sm font-semibold text-gray-700">Approving Officer <span className="text-red-500">*</span></p>
                        </div>
                        {approversLoading ? (
                            <div className="ml-7"><Spinner /></div>
                        ) : (
                            <div className="ml-7 space-y-2">
                                {approverList.map(u => (
                                    <button key={u._id} type="button" onClick={() => handleApproverSelect(u._id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                                            approverId === u._id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 hover:border-blue-300'
                                        }`}>
                                        {u.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Step 3: Staff Biometric (WebAuthn — unchanged) ─── */}
                    {biometricRequired && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${stepDone(biometricVerified)}`}>
                                    {biometricVerified ? '✓' : '3'}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">Your Biometric Verification</p>
                            </div>
                            <div className="ml-7">
                                {biometricVerified ? (
                                    <div className="flex items-center gap-2 text-green-700 text-sm">
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Identity verified
                                    </div>
                                ) : (
                                    <button type="button" onClick={handleBiometricScan}
                                        disabled={biometricLoading || !approverId}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white text-sm
                                            font-medium rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-colors">
                                        <Fingerprint className="w-4 h-4" />
                                        {biometricLoading ? 'Scanning…' : 'Scan Your Fingerprint'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Client Face Verification ───────────────── */}
                    {/* FIX: replaced QR-based WebAuthn polling with FaceVerifyStep */}
                    {/* Client must complete liveness challenge matching their LAF template */}
                    {requireClientBiometric && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${stepDone(clientVerified)}`}>
                                    {clientVerified ? '✓' : (biometricRequired ? '4' : '3')}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Client Face Verification
                                </p>
                            </div>
                            <div className="ml-7">
                                {clientVerified ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-green-700 text-sm">
                                            <CheckCircleIcon className="w-4 h-4" />
                                            Identity confirmed
                                        </div>
                                        {faceMatchScore !== null && (
                                            <p className="text-xs text-gray-400">
                                                Match confidence: {(
                                                    Math.max(0, (0.5 - faceMatchScore) / 0.5) * 100
                                                ).toFixed(0)}%
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <FaceVerifyStep
                                        faceTemplate={clientFaceTemplate}
                                        onVerified={(result) => {
                                            setClientVerified(true);
                                            setFaceMatchScore(result.faceMatchScore ?? null);
                                        }}
                                        onSkip={() => setClientVerified(true)}
                                        canSkip={
                                            currentUser?.role?.rep === 1 ||
                                            currentUser?.root === true
                                        }
                                    />
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
                            className={`p-2 flex-1 ${!canConfirm ? '!bg-gray-300 !text-gray-500 cursor-not-allowed' : ''}`}
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