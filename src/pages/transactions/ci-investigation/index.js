import React, { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Layout from '@/components/Layout';
import CISearchForm from '@/components/ci/CISearchForm';
import CIReviewPanel from '@/components/ci/CIReviewPanel';
import OfflineDraftBanner from '@/components/ci/OfflineDraftBanner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useCIDraftStorage } from '@/hooks/useCIDraftStorage';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import Spinner from '@/components/Spinner';
import moment from 'moment';
import { Printer, Search, RefreshCw, ChevronRight } from 'lucide-react';
import TempLAFModal from '@/components/laf/TempLAFModal';

// ── Status badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        pending:     { label: 'Pending CI',  cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
        ci_approved: { label: 'CI Approved', cls: 'bg-green-100 text-green-700 border border-green-200' },
        ci_declined: { label: 'CI Declined', cls: 'bg-red-100 text-red-700 border border-red-200' },
        promoted:    { label: 'Promoted',    cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500 border border-gray-200' };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
            {s.label}
        </span>
    );
};

// ── Applicant info card ───────────────────────────────────────────────────
const ApplicantCard = ({ application }) => {
    const rows = [
        ['CI Reference',  application.ciReferenceCode],
        ['Branch',        `${application.branchCode} — ${application.branchName}`],
        ['Full Name',     `${application.lastName}, ${application.firstName} ${application.middleName || ''}`],
        ['Birthdate',     application.birthdate],
        ['Contact',       application.contactNumber],
        ['Address',       application.address],
        ['Loan Amount',   application.loanAmount ? `₱${Number(application.loanAmount).toLocaleString()}` : '—'],
        ['Loan Purpose',  application.loanPurpose],
        ['Submitted',     moment(application.submittedAt).format('MMM DD, YYYY h:mm A')],
        ['Guarantor',     `${application.guarantorFirstName || ''} ${application.guarantorLastName || ''}`],
        ['Relationship',  application.guarantorRelationship],
        ['Guar. Contact', application.guarantorContactNumber],
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Applicant Information</h3>
                <StatusBadge status={application.status} />
            </div>
            <div className="space-y-2">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 text-xs
                        border-b border-gray-50 pb-2 last:border-0">
                        <span className="text-gray-500 flex-shrink-0 w-28">{label}</span>
                        <span className="text-gray-900 font-medium text-right">{value || '—'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── LAF photo ─────────────────────────────────────────────────────────────
const LAFPhotoCard = ({ lafPhotoUrl }) => {
    const [previewOpen, setPreviewOpen] = useState(false);

    if (!lafPhotoUrl) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Client Photo — Application (LAF)
            </h3>

            {/* Clickable thumbnail */}
            <div className="flex justify-center">
                <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="relative group rounded-xl overflow-hidden border
                        border-gray-200 hover:border-blue-400 transition-colors"
                >
                    <img
                        src={lafPhotoUrl}
                        alt="Client LAF photo"
                        className="w-40 h-40 object-cover"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0
                        group-hover:bg-opacity-30 transition-all flex items-center
                        justify-center">
                        <svg className="w-7 h-7 text-white opacity-0
                            group-hover:opacity-100 transition-opacity"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                    </div>
                </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
                Click to view full image
            </p>

            {/* Lightbox */}
            {previewOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 z-[9999]
                        flex items-center justify-center p-4"
                    onClick={() => setPreviewOpen(false)}
                >
                    <button
                        onClick={() => setPreviewOpen(false)}
                        className="absolute top-4 right-4 p-2 text-white
                            bg-white bg-opacity-10 rounded-full
                            hover:bg-opacity-20 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={lafPhotoUrl}
                        alt="Client LAF photo full view"
                        className="max-w-full max-h-full object-contain
                            rounded-lg shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                    <p className="absolute bottom-4 left-0 right-0 text-center
                        text-white text-xs opacity-50">
                        Tap anywhere outside to close
                    </p>
                </div>
            )}
        </div>
    );
};

// ── Applications list panel ───────────────────────────────────────────────
const ApplicationsList = ({ onSelect, selectedCode, refreshKey }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');

    // Bulk signed URLs for photos in list
    const photoKeys = applications.map(a => a.lafPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/applications/list${params}`
            );
            if (res.success) setApplications(res.applications);
            else toast.error('Failed to load applications.');
        } catch {
            toast.error('Error loading applications.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchList(); }, [fetchList, refreshKey]);

    // Search: name, CI code, contact, branch
    const filtered = applications.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
            `${a.lastName} ${a.firstName}`.toLowerCase().includes(q) ||
            a.ciReferenceCode?.toLowerCase().includes(q) ||
            a.contactNumber?.includes(q) ||
            a.branchName?.toLowerCase().includes(q) ||
            a.branchCode?.toLowerCase().includes(q)
        );
    });

    const statusOptions = [
        { value: 'pending',     label: 'Pending CI' },
        { value: 'ci_approved', label: 'CI Approved' },
        { value: 'ci_declined', label: 'Declined' },
        { value: 'all',         label: 'All' },
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* List header */}
            <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                        Applications
                    </h3>
                    <button
                        onClick={fetchList}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100
                            rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Status filter pills */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                    {statusOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium
                                transition-colors ${
                                statusFilter === opt.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Quick search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2
                        w-3.5 h-3.5 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, contact, CI code..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200
                            rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                            bg-gray-50"
                    />
                </div>
            </div>

            {/* List body */}
            {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <p className="text-xs">No applications found</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50 max-h-[calc(100vh-340px)] overflow-y-auto">
                    {filtered.map(app => {
                        const photoUrl = app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null;
                        return (
                            <button
                                key={app._id}
                                onClick={() => onSelect(app.ciReferenceCode)}
                                className={`w-full flex items-center gap-3 px-4 py-3
                                    transition-colors text-left group
                                    ${selectedCode === app.ciReferenceCode
                                        ? 'bg-blue-50 border-l-4 border-l-blue-500'  // selected state
                                        : 'hover:bg-gray-50 border-l-4 border-l-transparent'  // default + hover
                                    }`}
                            >
                                {/* Thumbnail */}
                                <div className="flex-shrink-0">
                                    {photoUrl ? (
                                        <img
                                            src={photoUrl}
                                            alt=""
                                            className="w-10 h-10 rounded-full object-cover
                                                border border-gray-200"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100
                                            border border-gray-200 flex items-center
                                            justify-center">
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
                                    <p className="text-xs font-mono text-blue-500 mt-0.5">
                                        {app.ciReferenceCode}
                                    </p>
                                </div>

                                {/* Status + arrow */}
                                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    <StatusBadge status={app.status} />
                                    <span className="text-xs text-gray-400">
                                        {moment(app.submittedAt).format('MMM DD')}
                                    </span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300
                                    group-hover:text-blue-400 flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Count footer */}
            {!loading && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-400">
                        {filtered.length} of {applications.length} applications
                    </p>
                </div>
            )}
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────
const CIInvestigationPage = () => {
    const isOnline = useOnlineStatus();
    const { getDrafts, removeDraft } = useCIDraftStorage();

    const [searchResult, setSearchResult] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [syncing, setSyncing]           = useState(false);
    const [draftCount, setDraftCount]     = useState(0);
    const [selectedCode, setSelectedCode] = useState(null);
    const [lafModalOpen, setLafModalOpen] = useState(false);
    const [listRefreshKey, setListRefreshKey] = useState(0);

    useEffect(() => {
        setDraftCount(getDrafts().length);
    }, [getDrafts]);

    // ── Load a specific application by CI code ────────────────────────────
    const loadApplication = useCallback(async (ciCode) => {
        setSelectedCode(ciCode);
        setLoadingDetail(true);
        setSearchResult(null);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/ci/${encodeURIComponent(ciCode)}`
            );
            if (!res.success) {
                toast.error(res.message || 'Application not found.');
                return;
            }
            setSearchResult(res);
        } catch {
            toast.error('Failed to load application.');
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    // ── Sync offline drafts ───────────────────────────────────────────────
    const handleSync = useCallback(async () => {
        const drafts = getDrafts();
        if (!drafts.length) return;
        setSyncing(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/ci/offline-sync',
                { drafts }
            );
            if (res.success) {
                res.results.forEach(r => { if (r.success) removeDraft(r.ciReferenceCode); });
                const failed = res.results.filter(r => !r.success).length;
                toast.success(failed === 0
                    ? `${drafts.length} draft(s) synced.`
                    : `${drafts.length - failed} synced, ${failed} failed.`
                );
                setDraftCount(getDrafts().length);
            } else {
                toast.error('Sync failed.');
            }
        } catch {
            toast.error('Sync error. Check connection.');
        } finally {
            setSyncing(false);
        }
    }, [getDrafts, removeDraft]);

    // ── After CI saved ────────────────────────────────────────────────────
    const handleSaved = useCallback(({ offline }) => {
        if (!offline && searchResult?.application?.ciReferenceCode) {
            // Refresh right side detail
            loadApplication(searchResult.application.ciReferenceCode);
            // Trigger left list refresh
            setListRefreshKey(k => k + 1);
        } else if (offline) {
            setDraftCount(getDrafts().length);
        }
    }, [searchResult, loadApplication, getDrafts]);

    return (
        <Layout>
            <div className="px-4 py-6">

                {/* Page header */}
                <div className="mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">CI Investigation</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Select an application from the list or search by CI reference code
                    </p>
                </div>

                {/* Offline banner */}
                <OfflineDraftBanner
                    isOnline={isOnline}
                    draftCount={draftCount}
                    onSync={handleSync}
                    syncing={syncing}
                />

                {/* Three-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* ── Left: applications list (col 4) ────────────────── */}
                    <div className="lg:col-span-4">
                        <ApplicationsList
                            onSelect={loadApplication}
                            selectedCode={selectedCode}
                            refreshKey={listRefreshKey}
                        />
                    </div>

                    {/* ── Right: detail + investigation form (col 8) ──────── */}
                    <div className="lg:col-span-8 space-y-4">

                        {/* CI code search — quick fallback */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase
                                tracking-wide mb-2">
                                Or search by CI Reference Code
                            </p>
                            <CISearchForm onFound={(res) => setSearchResult(res)} />
                        </div>

                        {/* Loading */}
                        {loadingDetail && (
                            <div className="flex justify-center py-12">
                                <Spinner />
                            </div>
                        )}

                        {/* Empty state */}
                        {!loadingDetail && !searchResult && (
                            <div className="text-center py-20 text-gray-300">
                                <ChevronRight className="w-12 h-12 mx-auto mb-3
                                    text-gray-200 rotate-180" />
                                <p className="text-sm text-gray-400">
                                    Select an application from the list
                                </p>
                                <p className="text-xs text-gray-300 mt-1">
                                    or enter a CI Reference Code above
                                </p>
                            </div>
                        )}

                        {/* Application detail + form */}
                        {!loadingDetail && searchResult && (
                            <>
                                {/* Status warnings */}
                                {searchResult.application?.status === 'promoted' && (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="text-sm font-semibold text-blue-800">
                                            This application has already been promoted to a client record.
                                        </p>
                                    </div>
                                )}

                                {searchResult.application?.status === 'ci_declined' && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <p className="text-sm font-semibold text-red-800">
                                            Previously declined. You can update the investigation below.
                                        </p>
                                    </div>
                                )}

                                {/* Print LAF button */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setLafModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                                            text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Printer className="w-4 h-4" />
                                        Print / Download LAF
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {/* Left: applicant info + photo */}
                                    <div className="space-y-4">
                                        <ApplicantCard application={searchResult.application} />
                                        <LAFPhotoCard lafPhotoUrl={searchResult.application?.lafPhotoUrl} />
                                    </div>

                                    {/* Right: investigation form */}
                                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                                            Investigation Form
                                        </h3>

                                        {searchResult.investigation && (
                                            <div className="mb-4 p-3 bg-gray-50 rounded-lg
                                                border border-gray-200 text-xs text-gray-600">
                                                <p className="font-semibold text-gray-700 mb-1">
                                                    Previous investigation on file
                                                </p>
                                                <p>By: {searchResult.investigation.picUserName || '—'}</p>
                                                <p>
                                                    {searchResult.investigation.investigatedAt
                                                        ? moment(searchResult.investigation.investigatedAt)
                                                            .format('MMM DD, YYYY h:mm A')
                                                        : '—'}
                                                </p>
                                                <p className="mt-1 italic text-gray-400">
                                                    Submitting below will update this record.
                                                </p>
                                            </div>
                                        )}

                                        <CIReviewPanel
                                            applicationData={searchResult}
                                            investigationData={searchResult.investigation}
                                            onSaved={handleSaved}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <TempLAFModal
                isOpen={lafModalOpen}
                onClose={() => setLafModalOpen(false)}
                application={{
                    ...searchResult?.application,
                    // enrich with branch info already in the search result
                    branchName: searchResult?.application?.branchName,
                    branchCode: searchResult?.application?.branchCode,
                }}
            />
        </Layout>
    );
};

export default CIInvestigationPage;