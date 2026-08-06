// src/components/groups/GroupQRModal.js
// Modal shown after generating a group QR.
// Displays QR image, group/branch/LO info, expiry, download + open tab.

import React, { useEffect, useRef, useState } from 'react';
import QRCode                                  from 'qrcode';
import moment                                  from 'moment';
import { X, Download, ExternalLink, RefreshCw, AlertTriangle, Copy } from 'lucide-react';
import { toast }                               from 'react-toastify';

/**
 * GroupQRModal
 *
 * Props:
 *   isOpen      — boolean
 *   onClose     — () => void
 *   onRegenerate— () => Promise<void>  (re-calls generate-qr API)
 *   qrData      — {
 *     url, qrToken, qrExpiresAt,
 *     groupName, groupNo,
 *     branchName, loName,
 *   }
 */
const GroupQRModal = ({ isOpen, onClose, onRegenerate, qrData }) => {
    const canvasRef          = useRef();
    const [dataUrl, setDataUrl] = useState(null);
    const [regenerating, setRegenerating] = useState(false);

    // Generate QR image whenever URL changes
    useEffect(() => {
        if (!qrData?.url || !isOpen) return;
        QRCode.toDataURL(qrData.url, {
            width:           400,
            margin:          2,
            color:           { dark: '#1e293b', light: '#ffffff' },
            errorCorrectionLevel: 'H',
        }).then(url => setDataUrl(url)).catch(console.error);
    }, [qrData?.url, isOpen]);

    const handleDownload = () => {
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href     = dataUrl;
        a.download = `ambercash-qr-${qrData.groupName?.replace(/\s+/g, '-').toLowerCase()}-${moment().format('YYYY-MM-DD')}.png`;
        a.click();
        toast.success('QR code downloaded.');
    };

    const handleOpenTab = () => {
        if (!qrData?.url) return;
        window.open(qrData.url, '_blank', 'noopener,noreferrer');
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(qrData?.url || '').then(() => {
            toast.success('URL copied to clipboard.');
        });
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            await onRegenerate?.();
        } finally {
            setRegenerating(false);
        }
    };

    const isExpiringSoon = qrData?.qrExpiresAt &&
        moment(qrData.qrExpiresAt).diff(moment(), 'days') <= 1;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center
            bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4
                    border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-900">Group QR Code</h2>
                    <button type="button" onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                {/* Group info */}
                <div className="px-5 pt-4 pb-2 space-y-1">
                    <InfoRow label="Branch"  value={qrData?.branchName} />
                    <InfoRow label="LO Name" value={qrData?.loName} />
                    <InfoRow label="Group"   value={qrData?.groupName} />
                </div>

                {/* QR image */}
                <div className="flex justify-center px-5 py-4">
                    {dataUrl ? (
                        <div className="border-4 border-blue-600 rounded-xl overflow-hidden
                            shadow-lg">
                            <img src={dataUrl} alt="Group QR Code"
                                className="w-56 h-56 object-contain" />
                        </div>
                    ) : (
                        <div className="w-56 h-56 bg-gray-100 rounded-xl flex items-center
                            justify-center">
                            <svg className="w-8 h-8 animate-spin text-gray-400"
                                fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                    stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                        </div>
                    )}
                </div>

                {/* Expiry notice */}
                <div className={`mx-5 mb-3 p-3 rounded-xl flex items-start gap-2 ${
                    isExpiringSoon
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-amber-50 border border-amber-200'
                }`}>
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        isExpiringSoon ? 'text-red-500' : 'text-amber-500'
                    }`} />
                    <div className="text-xs leading-relaxed">
                        <p className={`font-semibold ${
                            isExpiringSoon ? 'text-red-700' : 'text-amber-700'
                        }`}>
                            {isExpiringSoon ? 'Expiring soon!' : 'Weekly QR — regenerate every week'}
                        </p>
                        <p className={isExpiringSoon ? 'text-red-600' : 'text-amber-600'}>
                            Valid until{' '}
                            <strong>{moment(qrData?.qrExpiresAt).format('MMM D, YYYY h:mm A')}</strong>
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-5 pb-5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={handleDownload}
                            disabled={!dataUrl}
                            className="flex items-center justify-center gap-1.5 py-2.5
                                bg-blue-600 text-white text-xs font-semibold rounded-xl
                                hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            <Download className="w-3.5 h-3.5" />
                            Download QR
                        </button>
                        <button type="button" onClick={handleOpenTab}
                            className="flex items-center justify-center gap-1.5 py-2.5
                                border border-blue-300 text-blue-700 text-xs font-semibold
                                rounded-xl hover:bg-blue-50 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open in Tab
                        </button>
                    </div>
                    <button type="button" onClick={handleCopyUrl}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5
                            border border-gray-200 text-gray-600 text-xs font-medium
                            rounded-xl hover:bg-gray-50 transition-colors">
                        <Copy className="w-3.5 h-3.5" />
                        Copy URL
                    </button>
                    {(qrData?.availableSlots?.length > 0) && (
                        <button type="button" onClick={handleRegenerate}
                            disabled={regenerating}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5
                                border border-amber-300 text-amber-700 text-xs font-medium
                                rounded-xl hover:bg-amber-50 disabled:opacity-50 transition-colors">
                            {regenerating ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                            ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Regenerate QR
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const InfoRow = ({ label, value }) => (
    <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400 w-16 flex-shrink-0">{label}:</span>
        <span className="text-gray-900 font-medium">{value || '—'}</span>
    </div>
);

export default GroupQRModal;