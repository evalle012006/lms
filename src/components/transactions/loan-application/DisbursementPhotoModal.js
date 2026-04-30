import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { CameraIcon, ArrowUpTrayIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import Spinner from '@/components/Spinner';

// ── Roles that appear in the approver dropdown ─────────────────────────────
// rep=1 Admin/OD/Deputy Director, rep=2 RM/AM, rep=3 BM
const APPROVER_REPS = [1, 2, 3];

const DisbursementPhotoModal = ({
    show,
    loans = [],           // selected loans being approved
    onConfirm,            // (photoKey, approverId) => void
    onCancel,
}) => {
    const currentUser     = useSelector(s => s.user.data);

    const fileInputRef    = useRef();
    const [photo, setPhoto]           = useState(null);   // object URL for preview
    const [photoFile, setPhotoFile]   = useState(null);   // File object
    const [photoKey, setPhotoKey]     = useState(null);   // DO Spaces key after upload
    const [uploading, setUploading]   = useState(false);
    const [confirming, setConfirming] = useState(false);

    const [approverList, setApproverList]     = useState([]);
    const [approverId, setApproverId]         = useState(currentUser?._id || '');
    const [approversLoading, setApproversLoading] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (!show) return;
        setPhoto(null);
        setPhotoFile(null);
        setPhotoKey(null);
        setApproverId(currentUser?._id || '');
    }, [show, currentUser]);

    // Load approvers via dedicated /users/approvers endpoint
    // Returns BM (this branch) + AM (areaId) + RM (regionId) + OD (divisionId)
    useEffect(() => {
        if (!show || !currentUser?.designatedBranch) return;

        setApproversLoading(true);

        const roleMap = {
            'branch_manager':   'BM',
            'area_admin':       'AM',
            'regional_manager': 'RM',
            'deputy_director':  'OD',
        };

        const buildLabel = (u) => {
            const sc  = u.role?.shortCode || '';
            const prefix = roleMap[sc] || sc.toUpperCase() || 'STAFF';
            return `${prefix} — ${u.firstName} ${u.lastName}`;
        };

        fetchWrapper
            .get(getApiBaseUrl() + 'users/approvers?' +
                new URLSearchParams({ branchCode: currentUser.designatedBranch }))
            .then(r => {
                if (r.success) {
                    const admins = (r.users || [])
                        .map(u => ({ ...u, value: u._id, label: buildLabel(u) }))
                        .sort((a, b) => (a.role?.rep || 99) - (b.role?.rep || 99));
                    setApproverList(admins);
                }
            })
            .catch(() => {})
            .finally(() => setApproversLoading(false));
    }, [show, currentUser]);

    // ── File selection ──────────────────────────────────────────────────────
    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 5MB limit
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Photo must be under 5MB.');
            return;
        }

        setPhoto(URL.createObjectURL(file));
        setPhotoFile(file);
        setPhotoKey(null);

        // Upload immediately
        await uploadPhoto(file);
    }, [loans]);

    const uploadPhoto = async (file) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('origin', 'disbursement');
            // Use first loan's ID as the folder key — multi-loan approval shares one photo
            formData.append('uuid', loans[0]?._id || 'disbursement');

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            setPhotoKey(data.fileKey);
            toast.success('Photo uploaded.');
        } catch {
            toast.error('Failed to upload photo. Please try again.');
            setPhoto(null);
            setPhotoFile(null);
        } finally {
            setUploading(false);
        }
    };

    // ── Confirm ─────────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        if (!photoKey) {
            toast.error('Please upload a disbursement photo before approving.');
            return;
        }
        if (!approverId) {
            toast.error('Please select an approving officer.');
            return;
        }
        setConfirming(true);
        try {
            await onConfirm(photoKey, approverId);
        } finally {
            setConfirming(false);
        }
    };

    if (!show) return null;

    const loanCount = loans.length;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">LDF Disbursement Confirmation</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {loanCount} loan{loanCount !== 1 ? 's' : ''} selected for release
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        disabled={uploading || confirming}
                    >
                        <XMarkIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* Loan summary */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 max-h-32 overflow-y-auto">
                        {loans.map(l => (
                            <div key={l._id} className="flex items-center justify-between py-1">
                                <span className="text-xs font-medium text-blue-800">
                                    {l.fullName || l.clientName}
                                </span>
                                <span className="text-xs text-blue-500 font-mono">{l.pnNumber}</span>
                            </div>
                        ))}
                    </div>

                    {/* Disbursement photo upload */}
                    <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                            Disbursement Photo <span className="text-red-500">*</span>
                        </p>
                        <p className="text-xs text-gray-400 mb-3">
                            Take a photo of the client(s) receiving the release money.
                        </p>

                        {photo ? (
                            <div className="relative">
                                <img
                                    src={photo}
                                    alt="Disbursement"
                                    className="w-full h-48 object-cover rounded-xl border border-gray-200"
                                />
                                {uploading && (
                                    <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center
                                        justify-center rounded-xl">
                                        <Spinner />
                                    </div>
                                )}
                                {photoKey && !uploading && (
                                    <div className="absolute top-2 right-2 bg-green-500 text-white
                                        rounded-full p-1">
                                        <CheckCircleIcon className="w-4 h-4" />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPhoto(null);
                                        setPhotoFile(null);
                                        setPhotoKey(null);
                                    }}
                                    disabled={uploading}
                                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
                                >
                                    Remove photo
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl
                                    flex flex-col items-center justify-center gap-2
                                    hover:border-teal-400 hover:bg-teal-50 transition-colors
                                    disabled:opacity-50"
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center
                                    justify-center">
                                    <CameraIcon className="w-5 h-5 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-500">Tap to upload photo</p>
                                <p className="text-xs text-gray-300">JPG, PNG · Max 5MB</p>
                            </button>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"   // opens camera on mobile
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* Approving officer — inline list, no dropdown z-index issues */}
                    <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                            Approving Officer <span className="text-red-500">*</span>
                        </p>
                        {approversLoading ? (
                            <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Loading officers...
                            </div>
                        ) : (
                            <div className="border border-gray-200 rounded-xl overflow-y-auto max-h-48 p-2 space-y-2">
                                {approverList.map(u => (
                                    <button
                                        key={u._id}
                                        type="button"
                                        onClick={() => setApproverId(u._id)}
                                        className={`w-full flex items-center justify-between px-4 py-2.5
                                            rounded-xl border text-sm font-medium transition-colors text-left
                                            ${approverId === u._id
                                                ? 'bg-teal-600 border-teal-600 text-white'
                                                : 'bg-white border-gray-200 text-gray-700 hover:border-teal-400 hover:bg-teal-50'
                                            }`}
                                    >
                                        <span>{u.label}</span>
                                        {approverId === u._id && (
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none"
                                                stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                    strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <ButtonOutline
                        label="Cancel"
                        type="button"
                        onClick={onCancel}
                        disabled={uploading || confirming}
                    />
                    <ButtonSolid
                        label={confirming ? 'Approving...' : `Confirm & Approve ${loanCount} Loan${loanCount !== 1 ? 's' : ''}`}
                        type="button"
                        onClick={handleConfirm}
                        disabled={uploading || confirming || !photoKey}
                    />
                </div>
            </div>
        </div>
    );
};

export default DisbursementPhotoModal;