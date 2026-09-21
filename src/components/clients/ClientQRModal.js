// src/components/clients/ClientQRModal.js
// Modeled directly on GroupQRModal.js. Shows the generated QR image, client/
// branch/LO context, download + open-tab + regenerate actions.
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import moment from 'moment';
import { X, Download, ExternalLink, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '@/lib/ui/Modal';
import { buildQrBadgeDataUrl } from '@/lib/qrBadge';

/**
 * Props:
 *   show         — boolean
 *   onClose      — () => void
 *   onRegenerate — () => Promise<void>  (re-calls generate-qr, updates qrData)
 *   qrData       — { url, qrToken, qrGeneratedAt, clientName, branchName, loName }
 */
export default function ClientQRModal({ show, onClose, onRegenerate, qrData }) {
    const [dataUrl, setDataUrl] = useState(null);
    const [regenerating, setRegenerating] = useState(false);

    useEffect(() => {
        if (!qrData?.url || !show) return;
        const qrSize = 400;
        QRCode.toDataURL(qrData.url, {
            width: qrSize,
            margin: 2,
            color: { dark: '#1e293b', light: '#ffffff' },
            errorCorrectionLevel: 'H',
        })
            .then(rawQrDataUrl => buildQrBadgeDataUrl(rawQrDataUrl, {
                clientName: qrData.clientName,
                branchName: qrData.branchName,
                groupName: qrData.groupName,
            }, qrSize))
            .then(setDataUrl)
            .catch(console.error);
    }, [qrData?.url, qrData?.clientName, qrData?.branchName, qrData?.groupName, show]);

    const handleDownload = () => {
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `ambercash-client-qr-${(qrData.clientName || 'client').replace(/\s+/g, '-').toLowerCase()}.png`;
        a.click();
        toast.success('QR code downloaded.');
    };

    const handleOpenTab = () => {
        if (!qrData?.url) return;
        window.open(qrData.url, '_blank', 'noopener,noreferrer');
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(qrData?.url || '').then(() => toast.success('URL copied to clipboard.'));
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            await onRegenerate?.();
        } finally {
            setRegenerating(false);
        }
    };

    if (!qrData) return null;

    return (
        <Modal show={show} onClose={onClose} title="Client Collection QR" size="md">
            <div className="space-y-4">
                <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">{qrData.clientName}</p>
                    <p className="text-xs text-gray-400">{qrData.branchName} · {qrData.loName || '—'}</p>
                </div>

                <div className="flex justify-center">
                    {dataUrl ? (
                        <img src={dataUrl} alt="Client collection QR" className="w-56 h-56 rounded-lg border border-gray-100" />
                    ) : (
                        <div className="w-56 h-56 rounded-lg bg-gray-100 animate-pulse" />
                    )}
                </div>

                <p className="text-center text-xs text-gray-400">
                    No expiration — valid while this client is active.
                    {qrData.qrGeneratedAt && <> Generated {moment(qrData.qrGeneratedAt).format('MMM D, YYYY h:mm A')}.</>}
                </p>

                <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={handleDownload}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                        <Download className="w-4 h-4" /> Download
                    </button>
                    <button type="button" onClick={handleOpenTab}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                        <ExternalLink className="w-4 h-4" /> Open
                    </button>
                    <button type="button" onClick={handleCopyUrl}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                        <Copy className="w-4 h-4" /> Copy URL
                    </button>
                    <button type="button" onClick={handleRegenerate} disabled={regenerating}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} /> Regenerate
                    </button>
                </div>

                <p className="text-center text-[11px] text-amber-600">
                    Regenerating invalidates the current QR code immediately — any printed copy will stop working.
                </p>
            </div>
        </Modal>
    );
}