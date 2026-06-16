// src/components/laf/TemporaryLoanApplicationsTab.js
// FIX 1: Infinite scroll — load 20 at a time, auto-fetch on scroll sentinel
// FIX 2: Deduplicate API calls — removed second fetch, single source of truth
// FIX 3: Photo zoom — expand button on CandidateCard photos

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector }     from 'react-redux';
import { fetchWrapper }    from '@/lib/fetch-wrapper';
import { getApiBaseUrl }   from '@/lib/constants';
import { toast }           from 'react-toastify';
import Spinner             from '@/components/Spinner';
import moment              from 'moment';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import { useSignedUrl }    from 'hooks/useSignedUrl';
import placeholder         from '/public/images/image-placeholder.png';
import TempLAFModal        from '@/components/laf/TempLAFModal';
import { Printer, CheckCircle, XCircle, ZoomIn, X } from 'lucide-react';

const PAGE_SIZE = 20; // records per page

// ── Status badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        pending:            { label: 'Pending CI',           cls: 'bg-amber-100 text-amber-700' },
        ci_approved:        { label: 'CI Approved',          cls: 'bg-green-100 text-green-700' },
        ci_declined:        { label: 'CI Declined',          cls: 'bg-red-100 text-red-700' },
        promoted:           { label: 'Promoted',             cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
        pending_validation: { label: 'Pending Admin Review', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
        expired:            { label: 'Expired',              cls: 'bg-gray-100 text-gray-500' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500' };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
            {s.label}
        </span>
    );
};

// ── Row photo ─────────────────────────────────────────────────────────────
const RowPhoto = ({ urlMap, photoKey }) => {
    const resolvedUrl = photoKey ? urlMap[photoKey] : null;
    return resolvedUrl ? (
        <img src={resolvedUrl} alt="LAF photo"
            className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0"
            onError={e => { e.target.src = placeholder.src || '/images/image-placeholder.png'; }} />
    ) : (
        <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200
            flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        </div>
    );
};

// ── Modal photo ───────────────────────────────────────────────────────────
const ModalPhoto = ({ photoKey }) => {
    const { signedUrl, loading } = useSignedUrl(photoKey);
    if (!photoKey) return null;
    return (
        <div className="px-6 pt-4 pb-2 flex-shrink-0 flex flex-col items-center">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Client Photo (LAF)
            </p>
            {loading ? (
                <div className="w-36 h-36 rounded-xl bg-gray-100 border border-gray-200
                    flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            ) : signedUrl ? (
                <img src={signedUrl} alt="Client LAF photo"
                    className="w-36 h-36 object-cover rounded-xl border border-gray-200 shadow-sm"
                    onError={e => { e.target.style.display = 'none'; }} />
            ) : (
                <div className="w-36 h-36 rounded-xl bg-gray-100 border border-gray-200
                    flex items-center justify-center text-gray-400 text-xs">No photo</div>
            )}
        </div>
    );
};

// ── Photo zoom overlay ─────────────────────────────────────────────────────
const PhotoZoomOverlay = ({ src, label, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[100] flex items-center
        justify-center p-4" onClick={onClose}>
        <button type="button" onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-10 rounded-full
                text-white hover:bg-opacity-20 transition-colors">
            <X className="w-5 h-5" />
        </button>
        {label && (
            <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-xs
                font-medium bg-black bg-opacity-50 px-3 py-1 rounded-full">
                {label}
            </p>
        )}
        <img src={src} alt={label}
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()} />
    </div>
);

// ── Duplicate validation panel ─────────────────────────────────────────────
const DuplicateValidationPanel = ({ application, onValidated }) => {
    const currentUser = useSelector(s => s.user.data);
    const [note,    setNote]    = useState('');
    const [loading, setLoading] = useState(false);

    const canValidate =
        currentUser?.role?.rep === 1 ||
        currentUser?.root === true    ||
        ['regional_manager', 'deputy_director'].includes(currentUser?.role?.shortCode);

    if (!canValidate) {
        return (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <p className="text-xs font-semibold text-orange-800 mb-1">
                    ⚠ Pending Admin Validation
                </p>
                <p className="text-xs text-orange-700">
                    This application is flagged as a potential duplicate.
                    A regional manager, deputy director, or administrator must validate
                    before it can be promoted.
                    {(application.duplicateCandidateIds?.length > 0) && (
                        <span> Possible matches: <strong>{application.duplicateCandidateIds.length}</strong></span>
                    )}
                </p>
            </div>
        );
    }

    const handle = async (action) => {
        setLoading(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/validate-duplicate',
                { ciReferenceCode: application.ciReferenceCode, action, note }
            );
            if (res.success) {
                toast.success(action === 'approve'
                    ? 'Application approved — branch manager can now promote.'
                    : 'Application declined.');
                onValidated();
            } else {
                toast.error(res.message || 'Action failed.');
            }
        } catch {
            toast.error('Request failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-300 rounded-xl space-y-3">
            <div>
                <p className="text-sm font-semibold text-orange-900 mb-0.5">
                    ⚠ Duplicate Validation Required
                </p>
                <p className="text-xs text-orange-700">
                    This Prospect application was flagged as a potential duplicate of{' '}
                    <strong>{application.duplicateCandidateIds?.length || 0}</strong> existing
                    client record(s). Review before allowing promotion.
                </p>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Validation note (optional)..."
                rows={2}
                className="w-full px-3 py-2 text-xs border border-orange-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white resize-none" />
            <div className="flex gap-2">
                <button type="button" onClick={() => handle('approve')} disabled={loading}
                    className="flex-1 py-2 bg-green-600 text-white text-xs font-semibold
                        rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center
                        justify-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {loading ? 'Processing...' : 'Approve — Allow as New Client'}
                </button>
                <button type="button" onClick={() => handle('decline')} disabled={loading}
                    className="flex-1 py-2 bg-red-600 text-white text-xs font-semibold
                        rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center
                        justify-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    {loading ? 'Processing...' : 'Decline — Reject Application'}
                </button>
            </div>
        </div>
    );
};

// ── Detail modal ──────────────────────────────────────────────────────────
const ApplicationDetailModal = ({ application, onClose, onPrintLAF, onValidated }) => {
    // FIX 3: zoom state for photos inside detail modal
    const [zoom, setZoom] = useState(null); // { src, label }

    if (!application) return null;

    const fields = [
        ['CI Reference Code',   application.ciReferenceCode],
        ['Branch',              `${application.branchCode || ''} — ${application.branchName || ''}`],
        ['Client Type',         application.clientType
            ? application.clientType.charAt(0).toUpperCase() + application.clientType.slice(1)
            : 'Prospect'],
        ['Full Name',           `${application.lastName}, ${application.firstName} ${application.middleName || ''}`],
        ['Birthdate',           application.birthdate],
        ['Contact',             application.contactNumber],
        ['Address',             application.address],
        application.landmark           && ['Landmark',   application.landmark],
        application.distanceFromBranch && ['Distance',   application.distanceFromBranch],
        ['Loan Amount',         application.loanAmount
            ? `₱${Number(application.loanAmount).toLocaleString()}` : '—'],
        ['Loan Purpose',        application.loanPurpose],
        ['Guarantor',           `${application.guarantorFirstName || ''} ${application.guarantorLastName || ''}`.trim() || '—'],
        ['Guarantor Contact',   application.guarantorContactNumber],
        ['Relationship',        application.guarantorRelationship],
        application.governmentIdType   && ['ID Type',   application.governmentIdType],
        application.governmentIdNumber && ['ID Number', application.governmentIdNumber],
        ['Biometric',           application.biometricCredentialId
            ? `Registered${application.biometricDeviceName ? ` · ${application.biometricDeviceName}` : ''}`
            : 'Not yet registered'],
        application.isOffline          && ['Submission Mode', 'Offline (synced)'],
        application.isDuplicateFlagged && ['⚠ Duplicate Flag', 'Possible duplicate — requires admin validation'],
        application.duplicateValidatedBy && ['Validated By',
            `${application.duplicateValidatedBy} on ${moment(application.duplicateValidatedAt).format('MMM D, YYYY')}`],
        application.duplicateValidationNote && ['Validation Note', application.duplicateValidationNote],
        ['Submitted',           moment(application.submittedAt).format('MMM DD, YYYY h:mm A')],
        ['Expires',             moment(application.expiresAt).format('MMM DD, YYYY')],
        ['Status',              <StatusBadge key="s" status={application.status} />],
    ].filter(Boolean);

    return (
        <>
            {/* Photo zoom overlay */}
            {zoom && (
                <PhotoZoomOverlay src={zoom.src} label={zoom.label} onClose={() => setZoom(null)} />
            )}

            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center
                justify-center p-4"
                onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg
                    max-h-[90vh] flex flex-col">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4
                        border-b border-gray-100 flex-shrink-0">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Application Details</h2>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                                {application.ciReferenceCode}
                            </p>
                        </div>
                        <button onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400
                                hover:text-gray-600 transition-colors">✕</button>
                    </div>

                    {/* Photo — with zoom button */}
                    <div className="relative flex justify-center pt-4 pb-2 flex-shrink-0">
                        <ModalPhoto photoKey={application.lafPhotoKey} />
                        {application.lafPhotoUrl && (
                            <button type="button"
                                onClick={() => setZoom({ src: application.lafPhotoUrl, label: 'Applicant Photo' })}
                                className="absolute right-6 top-4 p-1.5 bg-gray-100 rounded-lg
                                    hover:bg-gray-200 text-gray-500 transition-colors"
                                title="Zoom photo">
                                <ZoomIn className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Fields */}
                    <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
                        {fields.map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-4 text-sm
                                border-b border-gray-50 pb-2 last:border-0">
                                <span className="text-gray-500 flex-shrink-0 w-40">{label}</span>
                                <span className="text-gray-900 font-medium text-right">
                                    {value || '—'}
                                </span>
                            </div>
                        ))}

                        {/* Client changes */}
                        {application.clientChanges &&
                         Object.entries(application.clientChanges).some(([, v]) => v?.trim()) && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl">
                                <p className="text-xs font-semibold text-amber-800 mb-2">
                                    ✎ Member reported the following changes
                                </p>
                                {[
                                    ['Last Name',   application.clientChanges.lastName],
                                    ['Middle Name', application.clientChanges.middleName],
                                    ['Contact No.', application.clientChanges.contactNumber],
                                    ['Street',      application.clientChanges.addressStreetNo],
                                    ['Barangay',    application.clientChanges.addressBarangayDistrict],
                                    ['City',        application.clientChanges.addressMunicipalityCity],
                                    ['Province',    application.clientChanges.addressProvince],
                                ].filter(([, v]) => v?.trim()).map(([label, value]) => (
                                    <div key={label} className="flex justify-between text-xs py-1
                                        border-b border-amber-100 last:border-0">
                                        <span className="text-amber-700">{label}</span>
                                        <span className="font-semibold text-amber-900">{value}</span>
                                    </div>
                                ))}
                                <p className="text-xs text-amber-600 mt-2 italic">
                                    These will be applied to the client record upon promotion.
                                </p>
                            </div>
                        )}

                        {/* Duplicate validation panel */}
                        {application.isDuplicateFlagged &&
                         application.status === 'pending_validation' && (
                            <DuplicateValidationPanel
                                application={application}
                                onValidated={() => { onValidated?.(); onClose(); }}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3">
                        <button onClick={() => { onPrintLAF?.(application); onClose(); }}
                            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium
                                rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" />
                            Print / Download LAF
                        </button>
                        <button onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-300 text-gray-700
                                text-sm font-medium rounded-lg hover:bg-gray-50">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// ── Main component ────────────────────────────────────────────────────────
const TemporaryLoanApplicationsTab = () => {
    const currentUser = useSelector(state => state.user.data);

    // FIX 1: Pagination state — infinite scroll
    const [applications,  setApplications]  = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [loadingMore,   setLoadingMore]   = useState(false);
    const [hasMore,       setHasMore]       = useState(true);
    const [offset,        setOffset]        = useState(0);
    const [totalCount,    setTotalCount]    = useState(0);
    const [statusFilter,  setStatusFilter]  = useState('all');
    const [search,        setSearch]        = useState('');
    const [selected,      setSelected]      = useState(null);
    const [lafModalOpen,  setLafModalOpen]  = useState(false);
    const [lafModalApp,   setLafModalApp]   = useState(null);

    // Infinite scroll sentinel
    const sentinelRef = useRef(null);
    const observerRef = useRef(null);

    // Bulk signed URLs for visible photos only
    const photoKeys = applications.map(a => a.lafPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    // ── Initial fetch (reset on filter change) ────────────────────────────
    const fetchInitial = useCallback(async () => {
        setLoading(true);
        setApplications([]);
        setOffset(0);
        setHasMore(true);
        try {
            const params = new URLSearchParams({ limit: PAGE_SIZE, offset: 0 });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/applications/list?${params}`
            );
            if (res.success) {
                setApplications(res.applications || []);
                setTotalCount(res.total || 0);
                setOffset(PAGE_SIZE);
                // FIX 2: use res.total for hasMore — avoids extra API call
                setHasMore((res.applications?.length || 0) === PAGE_SIZE &&
                    (res.total || 0) > PAGE_SIZE);
            } else {
                toast.error('Failed to load CI applications.');
            }
        } catch {
            toast.error('Error loading CI applications.');
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    useEffect(() => { fetchInitial(); }, [fetchInitial]);

    // ── Load next page ────────────────────────────────────────────────────
    const fetchMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/applications/list?${params}`
            );
            if (res.success) {
                const newApps = res.applications || [];
                setApplications(prev => [...prev, ...newApps]);
                setOffset(prev => prev + PAGE_SIZE);
                setHasMore(newApps.length === PAGE_SIZE &&
                    applications.length + newApps.length < (res.total || totalCount));
            }
        } catch {
            toast.error('Error loading more applications.');
        } finally {
            setLoadingMore(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingMore, hasMore, offset, statusFilter, applications.length, totalCount]);

    // ── IntersectionObserver for infinite scroll ──────────────────────────
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();
        observerRef.current = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting) fetchMore(); },
            { threshold: 0.1 }
        );
        if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
        return () => observerRef.current?.disconnect();
    }, [fetchMore]);

    // ── Print LAF ─────────────────────────────────────────────────────────
    const handlePrintLAF = useCallback(async (app, e) => {
        e?.stopPropagation();
        let appWithLoan = {
            ...app,
            lafPhotoUrl: app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null,
        };
        if (app.promotedClientId && app.status === 'promoted') {
            try {
                const res = await fetchWrapper.get(
                    getApiBaseUrl() + `clients/loan-history?clientId=${app.promotedClientId}`
                );
                const latestLoan = res.loans?.[0] || null;
                if (latestLoan) appWithLoan.loan = latestLoan;
            } catch { /* non-fatal */ }
        }
        setLafModalApp(appWithLoan);
        setLafModalOpen(true);
    }, [urlMap]);

    // Client-side search on loaded applications
    const filtered = applications.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            a.ciReferenceCode?.toLowerCase().includes(q) ||
            a.firstName?.toLowerCase().includes(q) ||
            a.lastName?.toLowerCase().includes(q) ||
            a.branchName?.toLowerCase().includes(q) ||
            a.contactNumber?.includes(q)
        );
    });

    const statusOptions = [
        { value: 'all',                label: 'All' },
        { value: 'pending',            label: 'Pending CI' },
        { value: 'ci_approved',        label: 'CI Approved' },
        { value: 'ci_declined',        label: 'CI Declined' },
        { value: 'promoted',           label: 'Promoted' },
        { value: 'pending_validation', label: 'Pending Admin Validation' },
    ];

    const pendingValidationCount = applications.filter(
        a => a.status === 'pending_validation'
    ).length;
    const canValidate = currentUser?.role?.rep === 1 || currentUser?.root ||
        ['regional_manager', 'deputy_director'].includes(currentUser?.role?.shortCode);

    return (
        <div className="p-4">

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex gap-2 flex-wrap">
                    {statusOptions.map(opt => (
                        <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium
                                transition-colors ${
                                statusFilter === opt.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 min-w-48">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, CI code, branch..."
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={fetchInitial}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300
                        text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 mb-4 text-xs text-gray-500">
                <span>
                    Showing <strong className="text-gray-900">{filtered.length}</strong>
                    {totalCount > 0 && <> of <strong className="text-gray-900">{totalCount}</strong></>}
                    {' '}applications
                </span>
                {canValidate && pendingValidationCount > 0 && (
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100
                            text-orange-700 rounded-full font-medium cursor-pointer"
                        onClick={() => setStatusFilter('pending_validation')}>
                        ⚠ {pendingValidationCount} need validation
                    </span>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0
                            01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No CI applications found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide w-12">Photo</th>
                                    {currentUser?.role?.rep < 3 && (
                                        <th className="px-4 py-3 text-left text-xs font-semibold
                                            text-gray-600 uppercase tracking-wide">Branch</th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">CI Reference</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">Applicant</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">Loan Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">Submitted</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map(app => (
                                    <tr key={app._id}
                                        onClick={() => setSelected(app)}
                                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                                            app.isDuplicateFlagged && app.status === 'pending_validation'
                                                ? 'bg-orange-50 hover:bg-orange-100'
                                                : ''
                                        }`}>
                                        <td className="px-4 py-3">
                                            <RowPhoto urlMap={urlMap} photoKey={app.lafPhotoKey} />
                                        </td>
                                        {currentUser?.role?.rep < 3 && (
                                            <td className="px-4 py-3 text-xs text-gray-600">
                                                <span className="font-mono">{app.branchCode}</span>
                                                <span className="ml-1 text-gray-400">{app.branchName}</span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs text-blue-600 font-medium">
                                                {app.ciReferenceCode}
                                            </span>
                                            {app.isDuplicateFlagged && (
                                                <span className="ml-1.5 inline-flex px-1.5 py-0.5
                                                    bg-orange-100 text-orange-600 text-[10px]
                                                    font-semibold rounded">DUP</span>
                                            )}
                                            {app.isBalikUnmatched && (
                                                <span className="ml-1.5 inline-flex px-1.5 py-0.5
                                                    bg-purple-100 text-purple-600 text-[10px]
                                                    font-semibold rounded">BALIK</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900">
                                                {app.lastName}, {app.firstName}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {app.contactNumber}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {app.loanAmount
                                                ? `₱${Number(app.loanAmount).toLocaleString()}`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {moment(app.submittedAt).format('MMM DD, YYYY')}
                                            <br />
                                            <span className="text-gray-400">
                                                {moment(app.submittedAt).format('h:mm A')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={app.status} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={e => { e.stopPropagation(); setSelected(app); }}
                                                    className="px-3 py-1 text-xs font-medium
                                                        text-blue-600 border border-blue-200
                                                        rounded-lg hover:bg-blue-50">View</button>
                                                <button
                                                    onClick={e => handlePrintLAF(app, e)}
                                                    className="px-3 py-1 text-xs font-medium
                                                        text-gray-600 border border-gray-200
                                                        rounded-lg hover:bg-gray-50
                                                        flex items-center gap-1"
                                                    title="Print / Download LAF">
                                                    <Printer className="w-3 h-3" />
                                                    LAF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Infinite scroll sentinel */}
                    <div ref={sentinelRef} className="py-4 flex justify-center">
                        {loadingMore && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Loading more...
                            </div>
                        )}
                        {!hasMore && applications.length > 0 && (
                            <p className="text-xs text-gray-400">
                                All {totalCount} applications loaded
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Detail modal */}
            <ApplicationDetailModal
                application={selected}
                onClose={() => setSelected(null)}
                onPrintLAF={app => handlePrintLAF({
                    ...app,
                    lafPhotoUrl: app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null,
                })}
                onValidated={fetchInitial}
            />

            {/* LAF print/download modal */}
            <TempLAFModal
                isOpen={lafModalOpen}
                onClose={() => { setLafModalOpen(false); setLafModalApp(null); }}
                application={lafModalApp}
            />
        </div>
    );
};

export default TemporaryLoanApplicationsTab;