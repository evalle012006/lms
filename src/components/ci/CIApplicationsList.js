// src/components/ci/CIApplicationsList.js
// FIX: Infinite scroll — 20 per page, sentinel-based auto-load
// FIX: sentinelRef uses scrollContainerRef as root so observer fires on list scroll
// FIX: initialLoadDone guard prevents sentinel firing on mount
// FIX: Server-side search — search now goes to the backend instead of only
//      filtering whatever page happened to be loaded locally. Debounced 300ms
//      so we don't fire a request per keystroke. fetchMore now also passes
//      search so paginated results stay consistent with page 1.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import moment from 'moment';
import { Search, RefreshCw, ChevronRight, WifiOff } from 'lucide-react';
import { fetchWrapper }    from '@/lib/fetch-wrapper';
import { getApiBaseUrl }   from '@/lib/constants';
import { toast }           from 'react-toastify';
import Spinner             from '@/components/Spinner';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';

const PAGE_SIZE_LIST   = 20;
const SEARCH_DEBOUNCE_MS = 300;

// ── Client type pill ──────────────────────────────────────────────────────
const CLIENT_TYPE_CONFIG = {
    prospect: { label: 'New',     cls: 'bg-green-100 text-green-700'  },
    reloan:   { label: 'Reloan',  cls: 'bg-blue-100 text-blue-700'    },
    pending:  { label: 'Pending', cls: 'bg-purple-100 text-purple-700' },
    balik:    { label: 'Balik',   cls: 'bg-orange-100 text-orange-700' },
};
const ClientTypePill = ({ clientType }) => {
    const cfg = CLIENT_TYPE_CONFIG[clientType] || {
        label: clientType || 'New', cls: 'bg-gray-100 text-gray-600',
    };
    return (
        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
};

// ── Status badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        pending:            { label: 'Pending CI',  cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
        ci_approved:        { label: 'CI Approved', cls: 'bg-green-100 text-green-700 border border-green-200' },
        ci_declined:        { label: 'CI Declined', cls: 'bg-red-100 text-red-700 border border-red-200' },
        promoted:           { label: 'Promoted',    cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
        pending_validation: { label: 'Pending Review', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500 border border-gray-200' };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
            {s.label}
        </span>
    );
};

// ── Main component ────────────────────────────────────────────────────────
const CIApplicationsList = ({
    onSelect,
    selectedCode,
    refreshKey,
    offlineApps,
    isOnline,
    getDrafts,
    onFilterChange,
}) => {
    const [applications,  setApplications]  = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [loadingMore,   setLoadingMore]   = useState(false);
    const [hasMore,       setHasMore]       = useState(true);
    const [offset,        setOffset]        = useState(0);
    const [total,         setTotal]         = useState(0);
    const [statusFilter,  setStatusFilter]  = useState('pending');

    // FIX: search split into immediate input value (for the text box) and a
    // debounced value (what actually drives the fetch). Typing stays instant;
    // the network call waits until the user pauses for SEARCH_DEBOUNCE_MS.
    const [searchInput, setSearchInput] = useState('');
    const [search,      setSearch]      = useState('');

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Refs
    const sentinelRef       = useRef(null);
    const observerRef       = useRef(null);
    const scrollContainerRef = useRef(null);  // FIX: used as observer root
    const initialLoadDone   = useRef(false);  // FIX: prevent sentinel firing on mount
    const offlineAppsRef    = useRef(offlineApps);
    const isOnlineRef       = useRef(isOnline);

    useEffect(() => { offlineAppsRef.current = offlineApps; }, [offlineApps]);
    useEffect(() => { isOnlineRef.current    = isOnline;    }, [isOnline]);

    const photoKeys = applications.map(a => a.lafPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    const draftCodes = new Set(
        (getDrafts?.() || []).map(d => d.ciReferenceCode)
    );

    // ── Fetch first page ──────────────────────────────────────────────────
    // FIX: `search` added to deps — this callback previously closed over
    // `search` without declaring it, so the effect below never re-ran when
    // the user typed (stale closure — fetchList's reference never changed,
    // so [fetchList, refreshKey] never saw a reason to fire).
    const fetchList = useCallback(async () => {
        if (!isOnlineRef.current) {
            setApplications(offlineAppsRef.current || []);
            setLoading(false);
            initialLoadDone.current = true;
            return;
        }
        setLoading(true);
        setApplications([]);
        setOffset(0);
        setHasMore(true);
        initialLoadDone.current = false;
        try {
            const params = new URLSearchParams({ limit: PAGE_SIZE_LIST, offset: 0 });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (search) params.set('search', search);
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/applications/list?${params}`
            );
            if (res.success) {
                const loaded = res.applications || [];
                setApplications(loaded);
                const knownTotal = res.total ?? null;
                setTotal(knownTotal ?? loaded.length);
                setOffset(PAGE_SIZE_LIST);
                // FIX: assume more when full page returned and total unknown or exceeds loaded
                setHasMore(
                    loaded.length === PAGE_SIZE_LIST &&
                    (knownTotal === null || knownTotal > PAGE_SIZE_LIST)
                );
            } else {
                toast.error('Failed to load applications.');
            }
        } catch {
            toast.error('Error loading applications.');
        } finally {
            setLoading(false);
            initialLoadDone.current = true; // FIX: now safe for sentinel to fire
        }
    }, [statusFilter, search]);

    useEffect(() => { fetchList(); }, [fetchList, refreshKey]);

    // ── Fetch next page ───────────────────────────────────────────────────
    // FIX: `search` now sent on paginated requests too — previously page 1
    // respected the search term but page 2+ silently dropped it, so scrolling
    // while searching mixed matching and non-matching rows in the same list.
    const fetchMore = useCallback(async () => {
        if (loadingMore || !hasMore || !isOnlineRef.current) return;
        setLoadingMore(true);
        try {
            const params = new URLSearchParams({ limit: PAGE_SIZE_LIST, offset });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (search) params.set('search', search);
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/applications/list?${params}`
            );
            if (res.success) {
                const newApps    = res.applications || [];
                const knownTotal = res.total ?? null;
                setApplications(prev => [...prev, ...newApps]);
                setOffset(prev => prev + PAGE_SIZE_LIST);
                if (knownTotal !== null) setTotal(knownTotal);
                setHasMore(
                    newApps.length === PAGE_SIZE_LIST &&
                    (knownTotal === null ||
                        (applications.length + newApps.length) < knownTotal)
                );
            }
        } catch {
            toast.error('Error loading more applications.');
        } finally {
            setLoadingMore(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingMore, hasMore, offset, statusFilter, search, applications.length]);

    // ── IntersectionObserver — uses scroll container as root ──────────────
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();
        observerRef.current = new IntersectionObserver(
            entries => {
                // FIX: guard against mount-time firing
                if (entries[0].isIntersecting && initialLoadDone.current) {
                    fetchMore();
                }
            },
            {
                root:      scrollContainerRef.current, // FIX: watch inside the list scroller
                threshold: 0.1,
            }
        );
        if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
        return () => observerRef.current?.disconnect();
    }, [fetchMore]);

    // FIX: removed client-side `filtered` — the server now returns the
    // correct search-matched set, so re-filtering `applications` locally was
    // redundant at best and, before the fetchList dep fix, was actively
    // masking the fact that search wasn't reaching the backend at all.

    const statusOptions = [
        { value: 'all',                label: 'All'            },
        { value: 'pending',            label: 'Pending CI'     },
        { value: 'ci_approved',        label: 'CI Approved'    },
        { value: 'ci_declined',        label: 'Declined'       },
        { value: 'promoted',           label: 'Promoted'       },
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">Applications</h3>
                        {!isOnline && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100
                                text-amber-700 text-xs rounded-full">
                                <WifiOff className="w-3 h-3" />Cached
                            </span>
                        )}
                    </div>
                    {isOnline && (
                        <button onClick={fetchList}
                            className="p-1.5 text-gray-400 hover:text-gray-600
                                hover:bg-gray-100 rounded-lg transition-colors"
                            title="Refresh">
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {isOnline && (
                    <div className="flex gap-1.5 mb-3 flex-wrap">
                        {statusOptions.map(opt => (
                            <button key={opt.value}
                                onClick={() => {
                                    setStatusFilter(opt.value);
                                    onFilterChange?.();
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium
                                    transition-colors ${
                                    statusFilter === opt.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                        text-gray-400" />
                    {/* FIX: input is bound to searchInput (instant) not search (debounced) */}
                    <input type="text" value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        placeholder="Search by name, contact, CI code..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200
                            rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                </div>
            </div>

            {/* List body */}
            {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
            ) : applications.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <p className="text-xs">
                        {!isOnline
                            ? 'No cached applications. Use "Prepare for Field Work" before going offline.'
                            : 'No applications found'}
                    </p>
                </div>
            ) : (
                // FIX: scrollContainerRef so IntersectionObserver root works correctly
                <div
                    ref={scrollContainerRef}
                    className="divide-y divide-gray-50 overflow-y-auto"
                    style={{ maxHeight: 'calc(100vh - 340px)' }}>
                    {applications.map(app => {
                        const photoUrl = app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null;
                        return (
                            <button key={app._id}
                                onClick={() => onSelect(app.ciReferenceCode)}
                                className={`w-full flex items-center gap-3 px-4 py-3
                                    transition-colors text-left group ${
                                    selectedCode === app.ciReferenceCode
                                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                        : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                                }`}>
                                <div className="flex-shrink-0">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt=""
                                            className="w-10 h-10 rounded-full object-cover
                                                border border-gray-200" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100
                                            border border-gray-200 flex items-center justify-center">
                                            <span className="text-sm font-semibold text-gray-400">
                                                {app.firstName?.charAt(0)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {app.lastName}, {app.firstName}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate mt-0.5">
                                        {app.contactNumber} · {app.branchCode}
                                    </p>
                                    <p className="text-xs font-mono text-blue-500 mt-0.5">
                                        {app.ciReferenceCode}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1 flex-wrap justify-end">
                                        <ClientTypePill clientType={app.clientType} />
                                        <StatusBadge status={app.status} />
                                    </div>
                                    {draftCodes.has(app.ciReferenceCode) && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700
                                            text-xs rounded-full font-medium">Draft</span>
                                    )}
                                    <span className="text-xs text-gray-400">
                                        {moment(app.submittedAt).format('MMM DD')}
                                    </span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300
                                    group-hover:text-blue-400 flex-shrink-0" />
                            </button>
                        );
                    })}

                    {/* FIX: sentinel INSIDE scroll container so observer fires on list scroll */}
                    <div ref={sentinelRef} className="py-4 flex justify-center">
                        {loadingMore && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none"
                                    viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Loading more...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Footer count — always visible outside scroll area */}
            {!loading && applications.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                    <p className="text-xs text-gray-400 text-center">
                        {applications.length}
                        {total > applications.length ? ` of ${total}` : ''}{' '}
                        application{applications.length !== 1 ? 's' : ''}
                        {!hasMore && total > 0 && applications.length >= total
                            ? ' — all loaded' : ''}
                    </p>
                </div>
            )}
        </div>
    );
};

export default CIApplicationsList;