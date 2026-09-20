// src/components/clients/ClientQRIconPopover.js
// Compact icon-trigger + small inline QR popover, for contexts (like
// ClientDetailPage, which sits inside a scrolling Modal) where the full
// ClientQRModal experience is too heavy — this stays anchored to a small
// icon in a corner rather than taking over the screen.
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import moment from 'moment';
import { QrCode, RefreshCw, X, Download, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const POPOVER_WIDTH = 240;

/**
 * Props:
 *   client      — the client record (needs _id, status, qrToken, qrGeneratedAt)
 *   onQrUpdated — (changes) => void, called with { qrToken, qrGeneratedAt }
 *                 after a successful generate/regenerate, so the caller can
 *                 patch its own client state/Redux without a full refetch.
 */
export default function ClientQRIconPopover({ client, onQrUpdated }) {
    const [open, setOpen] = useState(false);
    const [popoverPos, setPopoverPos] = useState(null);
    const [dataUrl, setDataUrl] = useState(null);
    const [generating, setGenerating] = useState(false);
    const triggerRef = useRef(null);
    const popoverRef = useRef(null);

    const qrUrl = client.qrToken
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/transactions/cash-collection/qr-collect/${client.qrToken}`
        : null;

    useEffect(() => {
        if (!qrUrl || !open) { setDataUrl(null); return; }
        QRCode.toDataURL(qrUrl, {
            width: 220,
            margin: 1,
            color: { dark: '#1e293b', light: '#ffffff' },
            errorCorrectionLevel: 'H',
        }).then(setDataUrl).catch(console.error);
    }, [qrUrl, open]);

    const openPopover = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPopoverPos({
            top: rect.bottom + 6,
            left: Math.max(8, rect.right - POPOVER_WIDTH),
        });
        setOpen(true);
    };

    const closePopover = () => {
        setOpen(false);
        setPopoverPos(null);
    };

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target) &&
                triggerRef.current && !triggerRef.current.contains(e.target)
            ) {
                closePopover();
            }
        };
        const handleScroll = () => closePopover();

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [open]);

    const handleTriggerClick = (e) => {
        e.stopPropagation();
        if (open) {
            closePopover();
        } else if (client.qrToken) {
            openPopover();
        } else {
            handleGenerate();
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/generate-qr', { clientId: client._id });
        setGenerating(false);
        if (res.success) {
            onQrUpdated?.({ qrToken: res.qr.qrToken, qrGeneratedAt: res.qr.qrGeneratedAt });
            openPopover();
        } else {
            toast.error(res.message || 'Failed to generate QR code.');
        }
    };

    const handleDownload = () => {
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `ambercash-client-qr-${(client.fullName || 'client').replace(/\s+/g, '-').toLowerCase()}.png`;
        a.click();
        toast.success('QR code downloaded.');
    };

    const handleOpenTab = () => {
        if (!qrUrl) return;
        window.open(qrUrl, '_blank', 'noopener,noreferrer');
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(qrUrl || '').then(() => toast.success('URL copied to clipboard.'));
    };

    if (client.status !== 'active') return null;

    const popover = open && popoverPos && (
        <div
            ref={popoverRef}
            className="fixed bg-white rounded-lg shadow-lg border border-gray-100 p-3 z-[1000]"
            style={{ top: popoverPos.top, left: popoverPos.left, width: POPOVER_WIDTH }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-700">Collection QR</p>
                <button type="button" onClick={closePopover} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="flex justify-center mb-2">
                {dataUrl ? (
                    <img src={dataUrl} alt="Client collection QR" className="w-40 h-40 rounded-md border border-gray-100" />
                ) : (
                    <div className="w-40 h-40 rounded-md bg-gray-100 animate-pulse" />
                )}
            </div>

            {client.qrGeneratedAt && (
                <p className="text-center text-[10px] text-gray-400 mb-2">
                    Issued {moment(client.qrGeneratedAt).format('MMM D, YYYY')}
                </p>
            )}

            <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={handleDownload}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                    <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button type="button" onClick={handleOpenTab}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                </button>
                <button type="button" onClick={handleCopyUrl}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                    <Copy className="w-3.5 h-3.5" /> Copy URL
                </button>
                <button type="button" onClick={handleGenerate} disabled={generating}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} /> Redo
                </button>
            </div>
            <p className="text-center text-[10px] text-amber-600 mt-1.5">
                Regenerating invalidates the current code immediately.
            </p>
        </div>
    );

    return (
        <div ref={triggerRef}>
            <button
                type="button"
                onClick={handleTriggerClick}
                disabled={generating}
                className={`p-2 rounded-full border transition-colors ${
                    client.qrToken
                        ? 'border-teal-200 bg-teal-50 text-teal-600 hover:bg-teal-100'
                        : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
                title={client.qrToken ? 'View collection QR' : 'Generate collection QR'}
                aria-label={client.qrToken ? 'View collection QR' : 'Generate collection QR'}
            >
                <QrCode className="w-4 h-4" />
            </button>
            {typeof document !== 'undefined' && popover && createPortal(popover, document.body)}
        </div>
    );
}