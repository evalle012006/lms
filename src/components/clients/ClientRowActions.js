// src/components/clients/ClientRowActions.js
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, UserMinus, Trash2, QrCode } from 'lucide-react';
import { useRouter } from 'next/router';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import moment from 'moment';

const MENU_WIDTH = 176; // w-44

export default function ClientRowActions({
    client, currentUser, variant, onDeleted, onExcluded, onQuickEdit, onQrGenerated,
}) {
    const [open, setOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [menuPos, setMenuPos] = useState(null); // { top, left } — computed from the trigger button's real screen position
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                triggerRef.current && !triggerRef.current.contains(e.target)
            ) {
                closeMenu();
            }
        };
        const handleScroll = () => closeMenu();

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [open]);

    const openMenu = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMenuPos({
            top: rect.bottom + 4,
            left: Math.max(8, rect.right - MENU_WIDTH),
        });
        setOpen(true);
    };

    const closeMenu = () => {
        setOpen(false);
        setConfirmDelete(false);
        setMenuPos(null);
    };

    const handleGenerateQR = async (e) => {
        e.stopPropagation();
        setOpen(false);
        const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/generate-qr', { clientId: client._id });
        if (res.success) {
            onQrGenerated?.(client._id, res.qr);
        } else {
            toast.error(res.message || 'Failed to generate QR code.');
        }
    };

    const handleToggle = (e) => {
        e.stopPropagation();
        if (open) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        setOpen(false);
        if (variant === 'prospect') {
            router.push(`/clients/edit/${client._id}`);
        } else {
            onQuickEdit?.(client);
        }
    };

    const handleExclude = async (e) => {
        e.stopPropagation();
        setOpen(false);

        if (client.status !== 'pending') {
            toast.error('Client must be in pending status to transfer.');
            return;
        }

        const willBeArchived = !(client.archived === true);
        const clientData = { ...client };
        clientData.archived = willBeArchived;
        clientData.archivedBy = currentUser._id;
        clientData.archivedDate = moment().format('YYYY-MM-DD');
        delete clientData.group;
        delete clientData.loans;
        delete clientData.lo;

        const res = await fetchWrapper.sendData(getApiBaseUrl() + 'clients/', clientData);
        if (res.success) {
            toast.success('Client successfully updated.');
            onExcluded?.(client._id, { archived: willBeArchived });
        } else {
            toast.error(res.message || 'Failed to update client.');
        }
    };

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        setConfirmDelete(true);
    };

    const handleDeleteConfirm = async (e) => {
        e.stopPropagation();
        const res = await fetchWrapper.postCors(getApiBaseUrl() + 'clients/delete', { _id: client._id });
        if (res.success) {
            toast.success('Client successfully deleted.');
            setOpen(false);
            setConfirmDelete(false);
            onDeleted?.(client._id);
        } else {
            toast.error(res.message || 'Failed to delete client.');
            setConfirmDelete(false);
        }
    };

    const menu = open && menuPos && (
        <div
            ref={menuRef}
            className="fixed w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-[1000]"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
        >
            {!confirmDelete ? (
                <>
                    <button type="button" onClick={handleEdit}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Pencil className="w-4 h-4" /> Edit Client
                    </button>
                    {variant === 'prospect' && (
                        <button type="button" onClick={handleExclude}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <UserMinus className="w-4 h-4" />
                            {client.archived ? 'Restore Client' : 'Exclude Client'}
                        </button>
                    )}
                    {variant === 'loan' && client.status === 'active' && (
                        <button type="button" onClick={handleGenerateQR}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <QrCode className="w-4 h-4" />
                            {client.qrToken ? 'View/Regenerate QR' : 'Generate QR Code'}
                        </button>
                    )}
                    <button type="button" onClick={handleDeleteClick}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" /> Delete Client
                    </button>
                </>
            ) : (
                <div className="px-3 py-2">
                    <p className="text-xs text-gray-600 mb-2">Delete this client? This can't be undone.</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={handleDeleteConfirm}
                            className="flex-1 px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">
                            Yes, delete
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                            className="flex-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div ref={triggerRef}>
            <button type="button" onClick={handleToggle}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                aria-label="Client actions">
                <MoreVertical className="w-4 h-4" />
            </button>
            {typeof document !== 'undefined' && menu && createPortal(menu, document.body)}
        </div>
    );
}