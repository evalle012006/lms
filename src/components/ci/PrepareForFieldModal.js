// src/components/ci/PrepareForFieldModal.js
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useCIOfflineCache } from '@/hooks/useCIOfflineCache';
import { X, Download, AlertTriangle, CheckSquare, Square, User } from 'lucide-react';
import moment from 'moment';
import Spinner from '@/components/Spinner';

const BATCH_LIMIT = 30;

/**
 * PrepareForFieldModal
 *
 * Allows BM/admin to select which pending CI applications they will
 * investigate in the field. Selected apps are claimed (assignedTo: userId)
 * on the server and cached to localStorage for offline use.
 *
 * Props:
 *   isOpen        — boolean
 *   onClose       — () => void
 *   currentUser   — Redux user object
 *   onCached      — (count) => void — called after successful cache
 */
const PrepareForFieldModal = ({ isOpen, onClose, currentUser, onCached }) => {
    const { saveCache } = useCIOfflineCache();

    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(false);
    const [caching, setCaching]           = useState(false);
    const [selected, setSelected]         = useState(new Set());

    // Load pending applications when modal opens
    useEffect(() => {
        if (!isOpen) return;
        setSelected(new Set());
        fetchApplications();
    }, [isOpen]);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'laf/applications/list?status=pending'
            );
            if (res.success) {
                setApplications(res.applications || []);
                // Pre-select apps already assigned to current user
                const myApps = (res.applications || [])
                    .filter(a => a.assignedTo === currentUser._id)
                    .map(a => a._id);
                setSelected(new Set(myApps));
            } else {
                toast.error('Failed to load applications.');
            }
        } catch {
            toast.error('Error loading applications.');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = useCallback((appId, app) => {
        // Cannot select apps claimed by others
        if (app.assignedTo && app.assignedTo !== currentUser._id) return;

        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(appId)) {
                next.delete(appId);
            } else {
                if (next.size >= BATCH_LIMIT) {
                    toast.warning(`Maximum ${BATCH_LIMIT} applications per field batch.`);
                    return prev;
                }
                next.add(appId);
            }
            return next;
        });
    }, [currentUser._id]);

    const handleSelectAll = () => {
        const selectable = applications
            .filter(a => !a.assignedTo || a.assignedTo === currentUser._id)
            .slice(0, BATCH_LIMIT)
            .map(a => a._id);
        setSelected(new Set(selectable));
        if (applications.length > BATCH_LIMIT) {
            toast.info(`Only first ${BATCH_LIMIT} selected (batch limit).`);
        }
    };

    const handleCacheAndGo = async () => {
        if (selected.size === 0) {
            toast.error('Please select at least one application.');
            return;
        }

        setCaching(true);
        try {
            // Claim selected applications on server
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/applications/assign',
                {
                    applicationIds: Array.from(selected),
                    action: 'claim',
                }
            );

            if (!res.success) {
                toast.error(res.message || 'Failed to claim applications.');
                if (res.conflicting?.length) {
                    // Refresh to show updated claim status
                    fetchApplications();
                }
                return;
            }

            // Save to localStorage — metadata only, no photos
            const saved = saveCache(res.applications, currentUser._id);
            if (!saved) {
                toast.error('Failed to save to device. Storage may be full.');
                return;
            }

            toast.success(
                `${res.applications.length} application(s) cached. You're ready to go offline.`,
                { autoClose: 6000 }
            );
            onCached?.(res.applications.length);
            onClose();
        } catch (err) {
            toast.error(err.message || 'An error occurred.');
        } finally {
            setCaching(false);
        }
    };

    if (!isOpen) return null;

    // Partition: mine, unclaimed, claimed by others
    // Treat claims older than 24hrs as expired (available to anyone)
    const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
    const isExpiredClaim = (app) =>
        app.assignedTo &&
        app.assignedAt &&
        (Date.now() - new Date(app.assignedAt).getTime()) > CLAIM_TTL_MS;

    const mine      = applications.filter(a => a.assignedTo === currentUser._id);
    const unclaimed = applications.filter(a => !a.assignedTo || isExpiredClaim(a));
    const others    = applications.filter(a =>
        a.assignedTo &&
        a.assignedTo !== currentUser._id &&
        !isExpiredClaim(a)
    );

    const sections = [
        { title: 'My Claimed Applications', items: mine,      badge: 'teal' },
        { title: 'Available',               items: unclaimed,  badge: 'blue' },
        { title: 'Claimed by Others',       items: others,     badge: 'gray' },
    ].filter(s => s.items.length > 0);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center
            bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl
                max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4
                    border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">
                            Prepare for Field Work
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Select applications to investigate · Max {BATCH_LIMIT} per batch
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Info banner */}
                <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200
                    rounded-xl flex gap-2.5 flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700 leading-relaxed">
                        <strong>How it works:</strong> Select the clients you will visit today.
                        The system will reserve them for you so other investigators don't
                        duplicate the work. Application data will be saved to your device
                        for offline access. Photos are not cached — metadata only.
                    </div>
                </div>

                {/* Selection counter + select all */}
                <div className="flex items-center justify-between px-6 py-3
                    border-b border-gray-100 flex-shrink-0">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-blue-600">{selected.size}</span>
                        {' '}of {Math.min(applications.length, BATCH_LIMIT)} selected
                    </p>
                    <button type="button" onClick={handleSelectAll}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium
                            underline underline-offset-2">
                        Select all available
                    </button>
                </div>

                {/* Application list */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
                    {loading ? (
                        <div className="flex justify-center py-12"><Spinner /></div>
                    ) : applications.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p className="text-sm">No pending applications found.</p>
                        </div>
                    ) : (
                        sections.map(section => (
                            <div key={section.title}>
                                <div className="flex items-center gap-2 mb-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase
                                        tracking-wide">
                                        {section.title}
                                    </p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                        ${section.badge === 'teal'
                                            ? 'bg-teal-100 text-teal-700'
                                            : section.badge === 'blue'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {section.items.length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {section.items.map(app => {
                                        const isClaimedByOther = app.assignedTo &&
                                            app.assignedTo !== currentUser._id &&
                                            !isExpiredClaim(app);
                                        const isSelected = selected.has(app._id);

                                        return (
                                            <button
                                                key={app._id}
                                                type="button"
                                                disabled={isClaimedByOther}
                                                onClick={() => toggleSelect(app._id, app)}
                                                className={`w-full flex items-center gap-3 p-3
                                                    rounded-xl border text-left transition-all
                                                    ${isClaimedByOther
                                                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                                        : isSelected
                                                            ? 'border-blue-400 bg-blue-50'
                                                            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                                                    }`}
                                            >
                                                {/* Checkbox */}
                                                <div className="flex-shrink-0">
                                                    {isClaimedByOther ? (
                                                        <User className="w-5 h-5 text-gray-400" />
                                                    ) : isSelected ? (
                                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-gray-300" />
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {app.lastName}, {app.firstName} {app.middleName || ''}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                        {app.contactNumber} · {app.address}
                                                    </p>
                                                    <p className="text-xs font-mono text-blue-500 mt-0.5">
                                                        {app.ciReferenceCode}
                                                    </p>
                                                </div>

                                                {/* Claimed by badge */}
                                                {isClaimedByOther && (
                                                    <span className="flex-shrink-0 px-2 py-1
                                                        bg-gray-100 text-gray-500 text-xs
                                                        rounded-lg whitespace-nowrap">
                                                        {app.assignedByName}
                                                    </span>
                                                )}

                                                {/* Submitted date */}
                                                <span className="flex-shrink-0 text-xs text-gray-400">
                                                    {moment(app.submittedAt).format('MMM D')}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4
                    border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
                    <button type="button" onClick={onClose}
                        disabled={caching}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700
                            text-sm font-medium rounded-xl hover:bg-gray-100
                            disabled:opacity-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCacheAndGo}
                        disabled={selected.size === 0 || caching || loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-teal-600
                            text-white text-sm font-semibold rounded-xl
                            hover:bg-teal-700 disabled:opacity-50
                            disabled:cursor-not-allowed transition-colors"
                    >
                        {caching ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Caching…
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Cache & Go ({selected.size})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrepareForFieldModal;