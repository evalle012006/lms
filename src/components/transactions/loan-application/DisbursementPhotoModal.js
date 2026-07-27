// src/components/transactions/loan-application/DisbursementPhotoModal.js
// Phase 6 update — client biometric step:
//   • If client has no biometric → REGISTER via QR (single-use 8hr token)
//   • If client has biometric → VERIFY via existing QR flow
//   • If requireClientBiometric = false → skip client biometric entirely
// Polling detects when client completes registration/verification on their device.
// Photo step uses PhotoCapture:
//   • Mobile → "Take Photo" (camera) + "Upload File" (gallery)
//   • Desktop → "Upload Photo" only

import React, { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { useSelector } from 'react-redux';
import { useSelector as useReduxSelector } from 'react-redux';
import {
    X,
    CheckCircle,
    Camera,
    QrCode,
    RefreshCw,
    Fingerprint,
    Upload,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBiometric } from '@/hooks/useBiometric';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import Spinner from '@/components/Spinner';
import PhotoCapture from '@/components/clients/PhotoCapture';

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

    // ── Client biometric state ────────────────────────────────────────────
    // clientBioMode: null | 'register' | 'verify'
    const [clientBioMode,    setClientBioMode]    = useState(null);
    const [clientVerified,   setClientVerified]   = useState(false);
    const [clientQrUrl,      setClientQrUrl]      = useState(null);
    const [clientQrDataUrl,  setClientQrDataUrl]  = useState(null);
    const [clientBioLoading, setClientBioLoading] = useState(false);
    const [polling,          setPolling]          = useState(false);
    const pollRef                                 = useRef(null);
    const [regTokenClientId, setRegTokenClientId] = useState(null);

    const [confirming, setConfirming] = useState(false);

    const roleMap = {
        branch_manager:   'BM',
        area_admin:       'AM',
        regional_manager: 'RM',
        deputy_director:  'OD',
    };

    // ── Reset on open ────────────────────────────────────────────────────
    useEffect(() => {
        if (!show) return;
        setPhoto(null); setPhotoFile(null); setPhotoKey(null);
        setApproverId(currentUser?._id || '');
        setBiometricVerified(false); setBiometricRequired(false);
        setClientBioMode(null); setClientVerified(false);
        setClientQrUrl(null); setClientQrDataUrl(null);
        setRegTokenClientId(null);
        setPolling(false);
        if (pollRef.current) clearInterval(pollRef.current);
    }, [show, currentUser]);

    // ── Determine client biometric mode when modal opens ─────────────────
    useEffect(() => {
        if (!show || !loans?.length || !requireClientBiometric) return;
        const firstLoan = loans[0];
        fetchWrapper.get(
            getApiBaseUrl() + `clients/biometric/status?clientId=${firstLoan.clientId || firstLoan.client?._id}`
        ).then(res => {
            if (res.success) {
                setClientBioMode(res.hasBiometric ? 'verify' : 'register');
            }
        }).catch(() => {
            setClientBioMode('verify');
        });
    }, [show, loans, requireClientBiometric]);

    // ── Generate client biometric QR ─────────────────────────────────────
    const generateClientBiometricQR = useCallback(async () => {
        if (!loans?.length) return;
        const firstLoan = loans[0];
        const clientId  = firstLoan.clientId || firstLoan.client?._id;
        const loanId    = firstLoan._id;

        setClientBioLoading(true);
        try {
            if (clientBioMode === 'register') {
                const res = await fetchWrapper.post(
                    getApiBaseUrl() + 'clients/biometric/register-token',
                    { clientId, loanId }
                );
                if (!res.success) throw new Error(res.message);
                const url = `${window.location.origin}/biometric-register/${encodeURIComponent(res.token)}`;
                setClientQrUrl(url);
                setRegTokenClientId(clientId);
                const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: 'H' });
                setClientQrDataUrl(dataUrl);
                startPollingBiometric(clientId, 'register');
            } else {
                const url = `${window.location.origin}/biometric-verify/${loanId}`;
                setClientQrUrl(url);
                const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: 'H' });
                setClientQrDataUrl(dataUrl);
                startPollingBiometric(clientId, 'verify');
            }
        } catch (err) {
            toast.error(err.message || 'Failed to generate QR code.');
        } finally {
            setClientBioLoading(false);
        }
    }, [loans, clientBioMode]);

    // ── Poll for client biometric completion ─────────────────────────────
    const startPollingBiometric = useCallback((clientId, mode) => {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(true);

        pollRef.current = setInterval(async () => {
            try {
                const endpoint = mode === 'register'
                    ? `clients/biometric/status?clientId=${clientId}`
                    : `transactions/loans/client-biometric-status?loanId=${loans[0]?._id}`;

                const res = await fetchWrapper.get(getApiBaseUrl() + endpoint);

                const done = mode === 'register'
                    ? res.success && res.hasBiometric
                    : res.success && res.verified;

                if (done) {
                    setClientVerified(true);
                    setPolling(false);
                    clearInterval(pollRef.current);
                    toast.success('Client biometric confirmed.');
                }
            } catch { /* ignore poll errors */ }
        }, 3000);
    }, [loans]);

    // Cleanup on unmount / close
    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

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

    // ── Upload photo ─────────────────────────────────────────────────────
    const uploadPhoto = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('origin', 'disbursement');
        formData.append('uuid', loans[0]?._id || `disbursement${Date.now()}`);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const ct  = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            throw new Error(res.status === 413 ? 'Photo is too large.' : `Upload error (${res.status}).`);
        }
        const data = await res.json();
        if (!data.fileKey) throw new Error(data.error || 'Upload failed.');
        return data.fileKey;
    }, [loans]);

    // ── Staff biometric scan ─────────────────────────────────────────────
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
            toast.error('Please complete client biometric before approving.');
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
                        <X className="w-5 h-5 text-gray-400" />
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
                                preview={photo}
                            />
                            {uploading && (
                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                    <Spinner />
                                    Uploading...
                                </div>
                            )}
                            {photoKey && !uploading && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" />
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
                            <p className="text-sm font-semibold text-gray-700">Approving Officer</p>
                        </div>
                        {approversLoading ? (
                            <div className="ml-7 flex items-center gap-2 text-xs text-gray-400">
                                <Spinner /> Loading approvers...
                            </div>
                        ) : (
                            <div className="ml-7 space-y-2">
                                {approverList.map(u => (
                                    <label key={u._id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                            approverId === u._id
                                                ? 'border-teal-400 bg-teal-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}>
                                        <input type="radio" name="approver" value={u._id}
                                            checked={approverId === u._id}
                                            onChange={() => handleApproverSelect(u._id)}
                                            className="text-teal-600" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800">{u.label}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Step 3: Staff Biometric ─────────────────────────── */}
                    {biometricRequired && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${stepDone(biometricVerified)}`}>
                                    {biometricVerified ? '✓' : '3'}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">Officer Biometric Verification</p>
                            </div>
                            <div className="ml-7">
                                {biometricVerified ? (
                                    <div className="flex items-center gap-2 text-green-700 text-sm">
                                        <CheckCircle className="w-4 h-4" />
                                        Identity verified
                                    </div>
                                ) : (
                                    <button type="button" onClick={handleBiometricScan}
                                        disabled={biometricLoading}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white
                                            text-sm font-medium rounded-xl hover:bg-gray-700
                                            disabled:opacity-50 transition-colors">
                                        {biometricLoading ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                                    stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v8H4z"/>
                                            </svg>
                                        ) : <Fingerprint className="w-4 h-4" />}
                                        {biometricLoading ? 'Scanning…' : 'Scan Your Fingerprint'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Client Biometric ────────────────────────── */}
                    {requireClientBiometric && clientBioMode && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${stepDone(clientVerified)}`}>
                                    {clientVerified ? '✓' : (biometricRequired ? '4' : '3')}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Client Biometric {clientBioMode === 'register' ? 'Registration' : 'Verification'}
                                </p>
                            </div>
                            <div className="ml-7">
                                {clientVerified ? (
                                    <div className="flex items-center gap-2 text-green-700 text-sm">
                                        <CheckCircle className="w-4 h-4" />
                                        {clientBioMode === 'register' ? 'Biometric registered' : 'Identity verified'}
                                    </div>
                                ) : clientQrDataUrl ? (
                                    <div className="space-y-3">
                                        {/* Mode badge */}
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            clientBioMode === 'register'
                                                ? 'bg-orange-100 text-orange-700'
                                                : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            <Fingerprint className="w-3 h-3" />
                                            {clientBioMode === 'register'
                                                ? 'New — Register fingerprint'
                                                : 'Existing — Verify fingerprint'}
                                        </div>
                                        {/* QR */}
                                        <div className="flex flex-col items-center gap-2 p-3 bg-gray-50
                                            rounded-xl border border-gray-200">
                                            <img src={clientQrDataUrl} alt="Client Biometric QR"
                                                className="w-36 h-36 object-contain" />
                                            <p className="text-xs text-gray-500 text-center">
                                                Ask client to scan this QR with their phone to{' '}
                                                {clientBioMode === 'register'
                                                    ? 'register their fingerprint / Face ID'
                                                    : 'verify their identity'}
                                            </p>
                                        </div>
                                        {/* Polling indicator */}
                                        {polling && (
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                                        stroke="currentColor" strokeWidth="4"/>
                                                    <path className="opacity-75" fill="currentColor"
                                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                                </svg>
                                                Waiting for client to complete…
                                            </div>
                                        )}
                                        {clientBioMode === 'register' && (
                                            <button type="button" onClick={generateClientBiometricQR}
                                                disabled={clientBioLoading}
                                                className="text-xs text-gray-400 hover:text-gray-600
                                                    underline flex items-center gap-1">
                                                <RefreshCw className="w-3 h-3" />
                                                Regenerate QR
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button type="button" onClick={generateClientBiometricQR}
                                        disabled={clientBioLoading}
                                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-300
                                            text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50
                                            disabled:opacity-50 transition-colors">
                                        {clientBioLoading ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                                    stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v8H4z"/>
                                            </svg>
                                        ) : <QrCode className="w-4 h-4" />}
                                        {clientBioMode === 'register'
                                            ? 'Generate Registration QR'
                                            : 'Generate Verification QR'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── No Face Template warning ────────────────────────── */}
                    {requireClientBiometric && clientBioMode === 'register' && !clientVerified && (
                        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                            <p className="text-sm font-semibold text-amber-800">
                                ⚠ No Face Template on Record
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                                This client did not complete face verification during their loan application.
                            </p>
                            <p className="text-xs text-amber-600 mt-0.5">
                                Contact a supervisor to authorise disbursement without face verification.
                            </p>
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