import React, { useState, useCallback, useEffect } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import moment from 'moment';
import { Search, FileSearch, Loader2 } from 'lucide-react';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';

// ── Lightbox ──────────────────────────────────────────────────────────────
const Lightbox = ({ url, onClose }) => {
    if (!url) return null;
    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex
                items-center justify-center p-4"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-white bg-white
                    bg-opacity-10 rounded-full hover:bg-opacity-20"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                        strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <img
                src={url}
                alt="Full view"
                className="max-w-full max-h-full object-contain rounded-lg
                    shadow-2xl"
                onClick={e => e.stopPropagation()}
            />
            <p className="absolute bottom-4 left-0 right-0 text-center
                text-white text-xs opacity-50">
                Tap outside to close
            </p>
        </div>
    );
};

// ── Paginated filtered CI list ────────────────────────────────────────────
const PAGE_SIZE = 6;

const FilteredCIList = ({ filter, onSelect }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [page, setPage]                 = useState(1);
    const [lightboxUrl, setLightboxUrl]   = useState(null);

    const photoKeys = applications.map(a => a.lafPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    useEffect(() => {
        fetchWrapper.get(getApiBaseUrl() + 'laf/applications/list?status=ci_approved')
            .then(res => { if (res.success) setApplications(res.applications); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // Reset to page 1 when filter changes
    useEffect(() => { setPage(1); }, [filter]);

    // Fuzzy filter
    const filtered = applications.filter(app => {
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
            app.firstName?.toLowerCase().includes(q) ||
            app.lastName?.toLowerCase().includes(q) ||
            `${app.lastName} ${app.firstName}`.toLowerCase().includes(q) ||
            `${app.firstName} ${app.lastName}`.toLowerCase().includes(q) ||
            app.ciReferenceCode?.toLowerCase().includes(q) ||
            app.contactNumber?.includes(q) ||
            app.branchCode?.toLowerCase().includes(q) ||
            app.branchName?.toLowerCase().includes(q)
        );
    });

    const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    if (filtered.length === 0) {
        return (
            <div className="text-center py-8 text-gray-400">
                <p className="text-xs">
                    {filter
                        ? `No approved applications matching "${filter}"`
                        : 'No approved CI applications found'}
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Lightbox */}
            <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

            <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* List items */}
                <div className="divide-y divide-gray-50">
                    {paginated.map(app => {
                        const photoUrl = app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null;
                        return (
                            <div key={app._id}
                                className="flex items-center gap-3 px-4 py-3
                                    hover:bg-blue-50 transition-colors group">

                                {/* Clickable photo thumbnail */}
                                <div className="flex-shrink-0">
                                    {photoUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => setLightboxUrl(photoUrl)}
                                            className="relative group/photo"
                                            title="Click to preview"
                                        >
                                            <img
                                                src={photoUrl}
                                                alt=""
                                                className="w-10 h-10 rounded-full object-cover
                                                    border border-gray-200
                                                    group-hover/photo:border-blue-400
                                                    transition-colors"
                                            />
                                            {/* Zoom hint */}
                                            <div className="absolute inset-0 bg-black
                                                bg-opacity-0 group-hover/photo:bg-opacity-30
                                                rounded-full transition-all flex items-center
                                                justify-center">
                                                <svg className="w-3 h-3 text-white opacity-0
                                                    group-hover/photo:opacity-100"
                                                    fill="none" stroke="currentColor"
                                                    viewBox="0 0 24 24">
                                                    <path strokeLinecap="round"
                                                        strokeLinejoin="round" strokeWidth={2}
                                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100
                                            border border-gray-200 flex items-center
                                            justify-center text-sm font-semibold text-gray-400">
                                            {app.firstName?.charAt(0)}
                                        </div>
                                    )}
                                </div>

                                {/* Info — clicking selects the application */}
                                <button
                                    type="button"
                                    onClick={() => onSelect(app.ciReferenceCode)}
                                    className="flex-1 min-w-0 text-left"
                                >
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {app.lastName}, {app.firstName}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                                        {app.contactNumber} · {app.branchCode}
                                    </p>
                                    <p className="text-xs font-mono text-blue-400 mt-0.5 truncate">
                                        {app.ciReferenceCode}
                                    </p>
                                </button>

                                {/* Date + select arrow */}
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    <p className="text-xs text-gray-400">
                                        {moment(app.submittedAt).format('MMM DD')}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(app.ciReferenceCode)}
                                        className="p-1 text-gray-300 group-hover:text-blue-400
                                            transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none"
                                            stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Pagination footer */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3
                        border-t border-gray-100 bg-gray-50">
                        <p className="text-xs text-gray-500">
                            {filtered.length} results · page {page} of {totalPages}
                        </p>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-2.5 py-1 text-xs font-medium border
                                    border-gray-200 rounded-lg text-gray-600
                                    hover:bg-gray-100 disabled:opacity-40
                                    disabled:cursor-not-allowed"
                            >
                                ← Prev
                            </button>
                            {/* Page number pills — show max 5 */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p =>
                                    p === 1 || p === totalPages ||
                                    Math.abs(p - page) <= 1
                                )
                                .reduce((acc, p, idx, arr) => {
                                    if (idx > 0 && p - arr[idx - 1] > 1) {
                                        acc.push('...');
                                    }
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${idx}`}
                                            className="px-2 py-1 text-xs text-gray-400">
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPage(p)}
                                            className={`px-2.5 py-1 text-xs font-medium
                                                rounded-lg border transition-colors ${
                                                page === p
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )
                            }
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-2.5 py-1 text-xs font-medium border
                                    border-gray-200 rounded-lg text-gray-600
                                    hover:bg-gray-100 disabled:opacity-40
                                    disabled:cursor-not-allowed"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// ── Approved CI Applications list ─────────────────────────────────────────
const ApprovedCIList = ({ onSelect }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);

    const photoKeys = applications.map(a => a.lafPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    useEffect(() => {
        fetchWrapper.get(getApiBaseUrl() + 'laf/applications/list?status=ci_approved')
            .then(res => {
                if (res.success) setApplications(res.applications);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    if (applications.length === 0) {
        return (
            <div className="text-center py-8 text-gray-400">
                <FileSearch className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-xs">No approved CI applications found</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {applications.map(app => {
                const photoUrl = app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null;
                return (
                    <button
                        key={app._id}
                        type="button"  // ← critical: prevent form submit
                        onClick={() => onSelect(app.ciReferenceCode)}
                        className="w-full flex items-center gap-3 px-4 py-3
                            hover:bg-blue-50 transition-colors text-left group"
                    >
                        {/* Photo */}
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

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {app.lastName}, {app.firstName}
                            </p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                                {app.contactNumber} · {app.branchCode}
                            </p>
                            <p className="text-xs font-mono text-blue-500 mt-0.5 truncate">
                                {app.ciReferenceCode}
                            </p>
                        </div>

                        {/* Date */}
                        <div className="flex-shrink-0 text-right">
                            <span className="inline-flex px-2 py-0.5 bg-green-100
                                text-green-700 text-xs font-medium rounded-full">
                                ✓ Approved
                            </span>
                            <p className="text-xs text-gray-400 mt-1">
                                {moment(app.submittedAt).format('MMM DD')}
                            </p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────
const ClientEntryPanel = ({ onCIFound }) => {
    // Name search
    const [nameSearch, setNameSearch]       = useState('');
    const [nameSearching, setNameSearching] = useState(false);
    const [nameResults, setNameResults]     = useState([]);
    const [nameSearched, setNameSearched]   = useState(false);

    // CI code search
    const [ciCode, setCiCode]               = useState('');
    const [ciSearching, setCiSearching]     = useState(false);
    const [ciResult, setCiResult]           = useState(null);
    const [ciError, setCiError]             = useState('');

    const [mode, setMode] = useState('ci'); // 'name' | 'ci' — default to CI tab

    // ── Name duplicate search ─────────────────────────────────────────────
    // NOT a form submit — called from button onClick
    const handleNameSearch = useCallback(async () => {
        if (!nameSearch.trim()) return;
        setNameSearching(true);
        setNameResults([]);
        setNameSearched(false);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'clients/search?' +
                new URLSearchParams({
                    searchText: nameSearch.toUpperCase(),
                    mode: 'duplicate',
                    cursor: '',
                })
            );
            if (res.success) {
                setNameResults(res.clients.map(c => ({
                    ...c,
                    fullName: `${c.lastName}, ${c.firstName} ${c.middleName || ''}`.trim(),
                })));
            }
        } catch {
            toast.error('Search failed.');
        } finally {
            setNameSearching(false);
            setNameSearched(true);
        }
    }, [nameSearch]);

    // ── CI code lookup — used by both search input and list click ─────────
    const handleCILookup = useCallback(async (code) => {
        const trimmed = (code || ciCode).trim().toUpperCase();
        if (!trimmed) return;
        setCiSearching(true);
        setCiResult(null);
        setCiError('');
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/promote/${encodeURIComponent(trimmed)}`
            );
            if (!res.success) {
                setCiError(res.message || 'CI code not found or not approved.');
                return;
            }
            setCiResult(res);
        } catch {
            setCiError('Failed to retrieve CI application.');
        } finally {
            setCiSearching(false);
        }
    }, [ciCode]);

    // Fuzzy filter on the approved list — re-uses ApprovedCIList by filtering via search
    // The list itself handles API fetch; we filter client-side via the search input
    const [ciListFilter, setCiListFilter] = useState('');

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Mode tabs */}
            <div className="flex border-b border-gray-100">
                <button
                    type="button"
                    onClick={() => {
                        setMode('name');
                        setCiResult(null);
                        setCiError('');
                    }}
                    className={`flex-1 py-3 text-sm font-medium transition-colors
                        flex items-center justify-center gap-2 ${
                        mode === 'name'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Search className="w-4 h-4" />
                    Check Duplicate Name
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMode('ci');
                        setNameResults([]);
                        setNameSearched(false);
                    }}
                    className={`flex-1 py-3 text-sm font-medium transition-colors
                        flex items-center justify-center gap-2 ${
                        mode === 'ci'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FileSearch className="w-4 h-4" />
                    Use CI Reference Code
                </button>
            </div>

            <div className="p-5">

                {/* ── Name search mode ──────────────────────────────────── */}
                {mode === 'name' && (
                    <>
                        <p className="text-xs text-gray-500 mb-3">
                            Search for an existing client to avoid duplicates.
                        </p>

                        {/* NO <form> — use div + button type=button */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={nameSearch}
                                onChange={e => setNameSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleNameSearch(); } }}
                                placeholder="Enter client name..."
                                className="flex-1 px-3 py-2.5 border border-gray-300
                                    rounded-lg text-sm focus:outline-none
                                    focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"  // ← prevent form submit
                                disabled={nameSearching || !nameSearch.trim()}
                                onClick={handleNameSearch}
                                className="px-4 py-2.5 bg-blue-600 text-white text-sm
                                    font-medium rounded-lg hover:bg-blue-700
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    flex items-center gap-2"
                            >
                                {nameSearching
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Search className="w-4 h-4" />}
                                Search
                            </button>
                        </div>

                        {/* Results */}
                        {nameSearched && nameResults.length > 0 && (
                            <div className="mt-4">
                                <div className="p-3 bg-amber-50 border border-amber-300
                                    rounded-lg mb-3">
                                    <p className="text-xs font-semibold text-amber-800">
                                        ⚠ Similar clients found — verify before proceeding
                                    </p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        If this is a new client, switch to the CI tab and
                                        select their approved application.
                                    </p>
                                </div>
                                <div className="divide-y divide-gray-100 border
                                    border-gray-200 rounded-lg overflow-hidden">
                                    {nameResults.map(c => (
                                        <div key={c._id}
                                            className="flex items-center gap-3 px-4 py-3
                                                bg-white text-sm">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">
                                                    {c.lastName}, {c.firstName}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {c.branchName} · {c.groupName}
                                                </p>
                                            </div>
                                            <span className={`text-xs font-semibold px-2 py-0.5
                                                rounded-full ${
                                                c.status === 'active'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {c.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {nameSearched && nameResults.length === 0 && (
                            <div className="mt-3 p-3 bg-green-50 border border-green-200
                                rounded-lg">
                                <p className="text-xs font-semibold text-green-700">
                                    ✓ No similar client found — safe to proceed
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* ── CI code mode ──────────────────────────────────────── */}
                {mode === 'ci' && (
                    <>
                        <p className="text-xs text-gray-500 mb-3">
                            Select from approved applications below, or search by name /
                            CI reference code.
                        </p>

                        {/* Fuzzy search input — filters the list AND does exact lookup */}
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={ciCode}
                                onChange={e => {
                                    setCiCode(e.target.value.toUpperCase());
                                    setCiListFilter(e.target.value.toUpperCase());
                                    setCiResult(null);
                                    setCiError('');
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCILookup();
                                    }
                                }}
                                placeholder="Search by name or CI code..."
                                className="flex-1 px-3 py-2.5 border border-gray-300
                                    rounded-lg text-sm focus:outline-none
                                    focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"  // ← prevent form submit
                                disabled={ciSearching || !ciCode.trim()}
                                onClick={() => handleCILookup()}
                                className="px-4 py-2.5 bg-blue-600 text-white text-sm
                                    font-medium rounded-lg hover:bg-blue-700
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    flex items-center gap-2"
                            >
                                {ciSearching
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Search className="w-4 h-4" />}
                                Search
                            </button>
                        </div>

                        {/* Error */}
                        {ciError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200
                                rounded-lg">
                                <p className="text-sm text-red-600">{ciError}</p>
                            </div>
                        )}

                        {/* CI result preview (after explicit search) */}
                        {ciResult && (
                            <div className="mb-4 border border-green-200 rounded-xl
                                overflow-hidden">
                                <div className="bg-green-50 px-4 py-3 flex items-center
                                    justify-between border-b border-green-200">
                                    <div>
                                        <p className="text-sm font-semibold text-green-800">
                                            CI Approved Application Found
                                        </p>
                                        <p className="text-xs font-mono text-green-600 mt-0.5">
                                            {ciResult.ciData?.ciReferenceCode}
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 bg-green-100 text-green-700
                                        text-xs font-semibold rounded-full border border-green-300">
                                        ✓ CI Approved
                                    </span>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="flex items-start gap-4">
                                        {ciResult.photos?.lafPhotoUrl && (
                                            <img src={ciResult.photos.lafPhotoUrl}
                                                alt="Applicant"
                                                className="w-14 h-14 rounded-xl object-cover
                                                    border border-gray-200 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 space-y-0.5 text-sm">
                                            <p className="font-semibold text-gray-900">
                                                {ciResult.clientData?.lastName},{' '}
                                                {ciResult.clientData?.firstName}{' '}
                                                {ciResult.clientData?.middleName}
                                            </p>
                                            <p className="text-gray-500 text-xs">
                                                {ciResult.clientData?.contactNumber}
                                            </p>
                                            <p className="text-xs text-blue-600">
                                                ₱{Number(ciResult.loanData?.loanAmount || 0)
                                                    .toLocaleString()}
                                                {ciResult.loanData?.loanPurpose
                                                    ? ` — ${ciResult.loanData.loanPurpose}`
                                                    : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Duplicate warning */}
                                    {ciResult.duplicateCandidates?.length > 0 && (
                                        <div className="mt-3 p-3 bg-amber-50 border
                                            border-amber-200 rounded-lg">
                                            <p className="text-xs font-semibold text-amber-800">
                                                ⚠ Similar client already exists
                                            </p>
                                            {ciResult.duplicateCandidates
                                                .slice(0, 2).map(c => (
                                                <p key={c._id} className="text-xs text-amber-700">
                                                    {c.lastName}, {c.firstName}
                                                </p>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => onCIFound?.(ciResult)}
                                        className="mt-4 w-full py-2.5 bg-blue-600 text-white
                                            text-sm font-semibold rounded-lg hover:bg-blue-700"
                                    >
                                        Use this application →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Approved CI list — filtered by search input */}
                        {!ciResult && (
                            <>
                                <p className="text-xs font-semibold text-gray-500 uppercase
                                    tracking-wide mb-2">
                                    Latest Approved Applications
                                </p>
                                <FilteredCIList
                                    filter={ciListFilter}
                                    onSelect={(code) => handleCILookup(code)}
                                />
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ClientEntryPanel;