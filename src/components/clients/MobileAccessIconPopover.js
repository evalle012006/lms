// src/components/clients/MobileAccessIconPopover.js
// Mirrors ClientQRIconPopover's shell (trigger icon + portal popover,
// position calc via getBoundingClientRect, click-outside to close) so it
// sits and behaves consistently with the QR icon beside it.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, X } from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const POPOVER_WIDTH = 260;

const STATE_LABELS = {
    active:         { label: 'Access active',            style: 'bg-green-50 text-green-700 border-green-200' },
    pending_review: { label: 'Self-registration pending', style: 'bg-amber-50 text-amber-700 border-amber-200' },
    not_enrolled:   { label: 'No mobile access',          style: 'bg-gray-50 text-gray-500 border-gray-200' },
    suspended:      { label: 'Access suspended',          style: 'bg-red-50 text-red-700 border-red-200' },
    deactivated:    { label: 'Access deactivated',        style: 'bg-gray-50 text-gray-500 border-gray-200' },
};

/**
 * Props:
 *   client — needs _id, status, contactNumber, firstName
 */
export default function MobileAccessIconPopover({ client }) {
    const [open, setOpen] = useState(false);
    const [popoverPos, setPopoverPos] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activating, setActivating] = useState(false);
    const triggerRef = useRef(null);
    const popoverRef = useRef(null);
    const isClientActive = client.status === 'active';

    const loadStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + `clients/mobile-enrollment/status?clientId=${client._id}`);
            if (res.success) setStatus(res);
        } finally {
            setLoading(false);
        }
    }, [client._id]);

    const openPopover = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPopoverPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - POPOVER_WIDTH) });
        setOpen(true);
        loadStatus();
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
        open ? closePopover() : openPopover();
    };

    async function handleActivate() {
        if (!client.contactNumber) {
            alert('This client has no contact number on file — add one before enabling mobile access.');
            return;
        }
        setActivating(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/mobile-enrollment/approve', {
                clientId: client._id, contactNumber: client.contactNumber, firstName: client.firstName,
            });
            if (res.success) await loadStatus();
            else alert(res.message || 'Failed to enable mobile access.');
        } finally {
            setActivating(false);
        }
    }

    async function handleReactivate() {
        setActivating(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/mobile-enrollment/reactivate', {
                clientId: client._id,
            });
            if (res.success) await loadStatus();
            else alert(res.message || 'Failed to reactivate account.');
        } finally {
            setActivating(false);
        }
    }

    const info = STATE_LABELS[status?.state] ?? STATE_LABELS.not_enrolled;

    const popover = open && popoverPos && (
        <div
            ref={popoverRef}
            className="fixed bg-white rounded-lg shadow-lg border border-gray-100 p-3 z-[1000]"
            style={{ top: popoverPos.top, left: popoverPos.left, width: POPOVER_WIDTH }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-700">Mobile App Access</p>
                <button type="button" onClick={closePopover} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {loading ? (
                <div className="h-16 flex items-center justify-center text-xs text-gray-400">Checking…</div>
            ) : (
                <>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${info.style}`}>
                        {info.label}
                    </span>

                    {status?.state === 'not_enrolled' && isClientActive && (
                        <button
                            type="button"
                            onClick={handleActivate}
                            disabled={activating}
                            className="mt-2 w-full px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {activating ? 'Enabling…' : 'Enable Mobile App Access'}
                        </button>
                    )}

                    {status?.state === 'not_enrolled' && !isClientActive && (
                        <p className="mt-2 text-[11px] text-gray-400">
                            Client must be active to enable mobile access.
                        </p>
                    )}

                    {status?.state === 'pending_review' && (
                        <a href="/settings/mobile-enrollment" className="mt-2 block text-[11px] text-blue-600 hover:underline">
                            Review request →
                        </a>
                    )}

                    {status?.state === 'suspended' && (
                        <button
                            type="button"
                            onClick={handleReactivate}
                            disabled={activating}
                            className="mt-2 w-full px-2 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
                        >
                            {activating ? 'Reactivating…' : 'Reactivate Access'}
                        </button>
                    )}
                </>
            )}
        </div>
    );

    return (
        <div ref={triggerRef}>
            <button
                type="button"
                onClick={handleTriggerClick}
                className="p-2 rounded-full border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                title="Mobile app access"
                aria-label="Mobile app access"
            >
                <Smartphone className="w-4 h-4" />
            </button>
            {typeof document !== 'undefined' && popover && createPortal(popover, document.body)}
        </div>
    );
}