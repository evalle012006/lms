import React, { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { useSelector } from 'react-redux';
import { CameraIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBiometric } from '@/hooks/useBiometric';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import Spinner from '@/components/Spinner';

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

    // ── Photo state ─────────────────────────────────────────────────────────
    const [photo, setPhoto]       = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoKey, setPhotoKey] = useState(null);
    const [uploading, setUploading] = useState(false);

    // ── Approver state ──────────────────────────────────────────────────────
    const [approverList, setApproverList]         = useState([]);
    const [approverId, setApproverId]             = useState('');
    const [approversLoading, setApproversLoading] = useState(false);

    // ── Biometric state ─────────────────────────────────────────────────────
    const [biometricVerified, setBiometricVerified] = useState(false);
    const [biometricRequired, setBiometricRequired] = useState(false);

    // ── Confirm state ───────────────────────────────────────────────────────
    const [confirming, setConfirming] = useState(false);

    // ── Client biometric QR state ────────────────────────────────────────
    const [qrDataUrl, setQrDataUrl]             = useState(null);
    const [clientVerified, setClientVerified]   = useState(false);
    const [polling, setPolling]                 = useState(false);
    const pollRef                               = useRef(null);

    const roleMap = {
        'branch_manager':   'BM',
        'area_admin':       'AM',
        'regional_manager': 'RM',
        'deputy_director':  'OD',
    };

    // Reset on open
    useEffect(() => {
        if (!show) return;
        setPhoto(null);
        setPhotoFile(null);
        setPhotoKey(null);
        setApproverId(currentUser?._id || '');
        setBiometricVerified(false);
        setBiometricRequired(false);
        setQrDataUrl(null);
        setClientVerified(false);
        setPolling(false);
        if (pollRef.current) clearInterval(pollRef.current);
    }, [show, currentUser]);

    // Generate QR code when loans are available
    useEffect(() => {
        if (!show || !loans?.length) return;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        // Use first loan's ID for QR — multi-loan shares one verification
        const url = `${origin}/biometric-verify/${loans[0]._id}`;
        QRCode.toDataURL(url, { width: 200, margin: 1 })
            .then(dataUrl => setQrDataUrl(dataUrl))
            .catch(() => {});
    }, [show, loans]);

    // Poll for client biometric verification — only when required
    useEffect(() => {
        if (!show || !loans?.length || clientVerified || !requireClientBiometric) return;
        // Start polling every 3 seconds
        setPolling(true);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetchWrapper.get(
                    getApiBaseUrl() + `transactions/loans/client-biometric-status?loanId=${loans[0]._id}`
                );
                if (res.success && res.verified) {
                    setClientVerified(true);
                    setPolling(false);
                    clearInterval(pollRef.current);
                }
            } catch { /* ignore poll errors */ }
        }, 3000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [show, loans, clientVerified]);

    // Load approvers
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

                    // Default to current user and immediately evaluate biometric requirement
                    // handleApproverSelect won't fire for the pre-selected default so do it here
                    const defaultId = currentUser._id || '';
                    setApproverId(defaultId);
                    const me = admins.find(u => u._id === defaultId);
                    setBiometricRequired(!!(me?.hasBiometric));
                }
            })
            .catch(() => {})
            .finally(() => setApproversLoading(false));
    }, [show, currentUser]);

    // When approver changes — check if biometric is needed
    const handleApproverSelect = (userId) => {
        setApproverId(userId);
        setBiometricVerified(false);

        const selected = approverList.find(u => u._id === userId);
        // Require biometric scan if:
        // 1. Selected approver is the currently logged-in user
        // 2. AND they have biometric registered
        const isCurrentUser = userId === currentUser?._id;
        const hasBiometric  = selected?.hasBiometric || false;
        setBiometricRequired(isCurrentUser && hasBiometric);
    };

    // ── Photo selection — store file locally, upload only on Confirm ────────
    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Photo must be under 5MB.');
            return;
        }
        setPhoto(URL.createObjectURL(file));
        setPhotoFile(file);
        setPhotoKey(null); // reset any previous key
    }, []);

    // ── Upload — called inside handleConfirm only ─────────────────────────
    const uploadPhoto = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('origin', 'disbursement');
        formData.append('uuid', loans[0]?._id || `disbursement${Date.now()}`);
        const res  = await fetch('/api/upload', { method: 'POST', body: formData });
        const ct   = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            throw new Error(res.status === 413 ? 'Photo is too large.' : `Upload error (${res.status}).`);
        }
        const data = await res.json();
        if (!data.fileKey) throw new Error(data.error || 'Upload failed.');
        return data.fileKey;
    }, [loans]);

    // ── Biometric scan ────────────────────────────────────────────────────
    const handleBiometricScan = async () => {
        const result = await authenticateWithBiometric(approverId);
        if (result.success) {
            setBiometricVerified(true);
            toast.success('Identity verified. You may now confirm approval.');
        } else if (result.fallback) {
            toast.error(result.error || 'Biometric failed. Please try again.');
        } else if (!result.cancelled) {
            toast.error(result.error || 'Biometric verification failed.');
        }
    };

    // ── Confirm — upload happens here, not on file select ────────────────
    const handleConfirm = async () => {
        if (!photoFile) {
            toast.error('Please take a disbursement photo before approving.');
            return;
        }
        if (!approverId) {
            toast.error('Please select an approving officer.');
            return;
        }
        if (biometricRequired && !biometricVerified) {
            toast.error('Please complete biometric verification before approving.');
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
            toast.error(err.message || 'Failed to upload photo. Please try again.');
        } finally {
            setConfirming(false);
        }
    };

    if (!show) return null;

    const loanCount    = loans.length;
    const selectedUser = approverList.find(u => u._id === approverId);
    const canConfirm   = photoFile && approverId &&
        (!biometricRequired || biometricVerified) &&
        (!requireClientBiometric || clientVerified) &&
        !uploading && !confirming;

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
                    <button type="button" onClick={onCancel}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        disabled={uploading || confirming}>
                        <XMarkIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* Loan summary */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 max-h-28 overflow-y-auto">
                        {loans.map(l => (
                            <div key={l._id} className="flex items-center justify-between py-1">
                                <span className="text-xs font-medium text-blue-800">
                                    {l.fullName || l.clientName}
                                </span>
                                <span className="text-xs text-blue-500 font-mono">{l.pnNumber}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Step 1: Disbursement Photo ──────────────────────── */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                                ${photoKey ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {photoKey ? '✓' : '1'}
                            </div>
                            <p className="text-sm font-semibold text-gray-700">
                                Disbursement Photo <span className="text-red-500">*</span>
                            </p>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 ml-7">
                            Take a photo of the client(s) receiving the release money.
                        </p>

                        {photo ? (
                            <div className="relative ml-7">
                                <img src={photo} alt="Disbursement"
                                    className="w-full h-44 object-cover rounded-xl border border-gray-200" />
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
                                    disabled={uploading}
                                    className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 underline">
                                    Remove photo
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="ml-7 w-[calc(100%-1.75rem)] h-32 border-2 border-dashed border-gray-200 rounded-xl
                                    flex flex-col items-center justify-center gap-2
                                    hover:border-teal-400 hover:bg-teal-50 transition-colors disabled:opacity-50">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                    <CameraIcon className="w-5 h-5 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-500">Tap to upload photo</p>
                                <p className="text-xs text-gray-300">JPG, PNG · Max 5MB</p>
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*"
                            capture="environment" onChange={handleFileChange} className="hidden" />
                    </div>

                    {/* ── Step 2: Approving Officer ───────────────────────── */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                                ${approverId ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {approverId ? '✓' : '2'}
                            </div>
                            <p className="text-sm font-semibold text-gray-700">
                                Approving Officer <span className="text-red-500">*</span>
                            </p>
                        </div>

                        {approversLoading ? (
                            <div className="flex items-center gap-2 py-3 text-xs text-gray-400 ml-7">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Loading officers...
                            </div>
                        ) : (
                            <div className="ml-7 border border-gray-200 rounded-xl overflow-y-auto max-h-44 p-2 space-y-2">
                                {approverList.map(u => {
                                    const isSelected = approverId === u._id;
                                    const isMe       = u._id === currentUser?._id;
                                    return (
                                        <button key={u._id} type="button"
                                            onClick={() => handleApproverSelect(u._id)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5
                                                rounded-xl border text-sm font-medium transition-colors text-left
                                                ${isSelected
                                                    ? 'bg-teal-600 border-teal-600 text-white'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:border-teal-400 hover:bg-teal-50'
                                                }`}>
                                            <div className="flex items-center gap-2">
                                                <span>{u.label}</span>
                                                {isMe && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full
                                                        ${isSelected ? 'bg-teal-500 text-teal-100' : 'bg-gray-100 text-gray-500'}`}>
                                                        you
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {/* Biometric badge */}
                                                {u.hasBiometric ? (
                                                    <span title="Has biometric registered"
                                                        className={`text-xs flex items-center gap-1
                                                            ${isSelected ? 'text-teal-200' : 'text-teal-600'}`}>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                                        </svg>
                                                    </span>
                                                ) : (
                                                    <span title="No biometric registered"
                                                        className={`text-xs ${isSelected ? 'text-teal-200' : 'text-amber-500'}`}>
                                                        ⚠
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Step 3: Biometric verification (if required) ────── */}
                    {biometricRequired && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                                    ${biometricVerified ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
                                    {biometricVerified ? '✓' : '3'}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Verify Your Identity <span className="text-red-500">*</span>
                                </p>
                            </div>

                            <div className="ml-7">
                                {biometricVerified ? (
                                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                                        <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-green-800">Identity Verified</p>
                                            <p className="text-xs text-green-600 mt-0.5">
                                                {selectedUser?.label} confirmed via fingerprint
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                                            As the selected approver, please verify your identity
                                            using your registered fingerprint before confirming approval.
                                        </p>
                                        <button type="button" onClick={handleBiometricScan}
                                            disabled={biometricLoading}
                                            className="w-full py-2.5 bg-amber-500 text-white text-sm font-semibold
                                                rounded-xl hover:bg-amber-600 active:scale-95
                                                disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                                            {biometricLoading ? (
                                                <>
                                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                                    </svg>
                                                    Scanning...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                                    </svg>
                                                    Scan Fingerprint to Confirm
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Client Biometric via QR — only when required ── */}
                    {requireClientBiometric && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                                    ${clientVerified ? 'bg-green-500 text-white' : 'bg-blue-400 text-white'}`}>
                                    {clientVerified ? '✓' : biometricRequired ? '4' : '3'}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Client Identity Verification <span className="text-red-500">*</span>
                                </p>
                            </div>

                            <div className="ml-7">
                                {clientVerified ? (
                                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                                        <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-green-800">Client Verified</p>
                                            <p className="text-xs text-green-600 mt-0.5">
                                                Client fingerprint confirmed on their device
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                                        <p className="text-xs text-blue-700 leading-relaxed">
                                            Ask the client to scan this QR code with their phone.
                                            They will be prompted to verify using their fingerprint or Face ID.
                                        </p>
                                        {qrDataUrl ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <img src={qrDataUrl} alt="Client verification QR"
                                                    className="w-40 h-40 rounded-xl border border-blue-200" />
                                                <div className="flex items-center gap-2 text-xs text-blue-500">
                                                    {polling && (
                                                        <svg className="w-3 h-3 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                                        </svg>
                                                    )}
                                                    Waiting for client to scan...
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-center py-4">
                                                <svg className="w-6 h-6 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 sticky bottom-0">
                    <ButtonOutline label="Cancel" type="button" onClick={onCancel}
                        disabled={uploading || confirming} />
                    <ButtonSolid
                        label={confirming ? 'Approving...' : `Confirm & Approve ${loanCount} Loan${loanCount !== 1 ? 's' : ''}`}
                        type="button"
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                    />
                </div>
            </div>
        </div>
    );
};

export default DisbursementPhotoModal;