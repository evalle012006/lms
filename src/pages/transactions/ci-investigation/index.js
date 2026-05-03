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
import { Briefcase, Printer, Search, RefreshCw, ChevronRight, WifiOff } from 'lucide-react';
import TempLAFModal from '@/components/laf/TempLAFModal';
import PrepareForFieldModal from '@/components/ci/PrepareForFieldModal';
import { useCIOfflineCache } from '@/hooks/useCIOfflineCache';

const StatusBadge = ({ status }) => {
    const map = {
        pending:     { label: 'Pending CI',  cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
        ci_approved: { label: 'CI Approved', cls: 'bg-green-100 text-green-700 border border-green-200' },
        ci_declined: { label: 'CI Declined', cls: 'bg-red-100 text-red-700 border border-red-200' },
        promoted:    { label: 'Promoted',    cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500 border border-gray-200' };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

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
                    <div key={label} className="flex justify-between gap-4 text-xs border-b border-gray-50 pb-2 last:border-0">
                        <span className="text-gray-500 flex-shrink-0 w-28">{label}</span>
                        <span className="text-gray-900 font-medium text-right">{value || '—'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LAFPhotoCard = ({ lafPhotoUrl }) => {
    const [previewOpen, setPreviewOpen] = useState(false);
    if (!lafPhotoUrl) return null;
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Client Photo — Application (LAF)</h3>
            <div className="flex justify-center">
                <button type="button" onClick={() => setPreviewOpen(true)}
                    className="relative group rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                    <img src={lafPhotoUrl} alt="Client LAF photo" className="w-40 h-40 object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <svg className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                    </div>
                </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">Click to view full image</p>
            {previewOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
                    <button onClick={() => setPreviewOpen(false)} className="absolute top-4 right-4 p-2 text-white bg-white bg-opacity-10 rounded-full hover:bg-opacity-20 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <img src={lafPhotoUrl} alt="full view" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                    <p className="absolute bottom-4 left-0 right-0 text-center text-white text-xs opacity-50">Tap anywhere outside to close</p>
                </div>
            )}
        </div>
    );
};

const ApplicationsList = ({ onSelect, selectedCode, refreshKey, offlineApps, isOnline, getDrafts }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');

    const photoKeys = applications.map(a => a.lafPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    // Build a Set of ciReferenceCodes that have pending offline drafts
    // so we can show a visual indicator on those items in the list
    const draftCodes = new Set(
        (getDrafts?.() || []).map(d => d.ciReferenceCode)
    );

    const fetchList = useCallback(async () => {
        if (!isOnline) {
            setApplications(offlineApps || []);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
            const res = await fetchWrapper.get(getApiBaseUrl() + `laf/applications/list${params}`);
            if (res.success) setApplications(res.applications);
            else toast.error('Failed to load applications.');
        } catch { toast.error('Error loading applications.'); }
        finally { setLoading(false); }
    }, [statusFilter, isOnline, offlineApps]);

    useEffect(() => { fetchList(); }, [fetchList, refreshKey]);

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
        { value: 'pending', label: 'Pending CI' },
        { value: 'ci_approved', label: 'CI Approved' },
        { value: 'ci_declined', label: 'Declined' },
        { value: 'all', label: 'All' },
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">Applications</h3>
                        {!isOnline && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                                <WifiOff className="w-3 h-3" />Cached
                            </span>
                        )}
                    </div>
                    {isOnline && (
                        <button onClick={fetchList} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {isOnline && (
                    <div className="flex gap-1.5 mb-3 flex-wrap">
                        {statusOptions.map(opt => (
                            <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, contact, CI code..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                </div>
            </div>
            {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <p className="text-xs">{!isOnline ? 'No cached applications. Use "Prepare for Field Work" before going offline.' : 'No applications found'}</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50 max-h-[calc(100vh-340px)] overflow-y-auto">
                    {filtered.map(app => {
                        const photoUrl = app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null;
                        return (
                            <button key={app._id} onClick={() => onSelect(app.ciReferenceCode)}
                                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group ${selectedCode === app.ciReferenceCode ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                                <div className="flex-shrink-0">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                                            <span className="text-sm font-semibold text-gray-400">{app.firstName?.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{app.lastName}, {app.firstName}</p>
                                    <p className="text-xs text-gray-400 truncate mt-0.5">{app.contactNumber} · {app.branchCode}</p>
                                    <p className="text-xs font-mono text-blue-500 mt-0.5">{app.ciReferenceCode}</p>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    <StatusBadge status={app.status} />
                                    {draftCodes.has(app.ciReferenceCode) && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700
                                            text-xs rounded-full font-medium">
                                            Draft
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-400">{moment(app.submittedAt).format('MMM DD')}</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>
            )}
            {!loading && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-400">
                        {filtered.length} of {applications.length} application{applications.length !== 1 ? 's' : ''}
                        {!isOnline ? ' (offline cache)' : ''}
                    </p>
                </div>
            )}
        </div>
    );
};

const CIInvestigationPage = () => {
    const currentUser    = useSelector(state => state.user.data);
    const systemSettings = useSelector(state => state.systemSettings.data);
    const isOnline = useOnlineStatus();
    const { getDrafts, removeDraft } = useCIDraftStorage({
        onDraftChange: (count) => setDraftCount(count),
    });
    const { getCache, clearCache, getCacheInfo } = useCIOfflineCache();

    const [searchResult,   setSearchResult]   = useState(null);
    const [loadingDetail,  setLoadingDetail]  = useState(false);
    const [syncing,        setSyncing]        = useState(false);
    const [draftCount,     setDraftCount]     = useState(0);
    const [selectedCode,   setSelectedCode]   = useState(null);
    const [lafModalOpen,   setLafModalOpen]   = useState(false);
    const [listRefreshKey, setListRefreshKey] = useState(0);
    const [fieldModalOpen, setFieldModalOpen] = useState(false);
    const [cacheInfo,      setCacheInfo]      = useState(null);
    const [offlineApps,    setOfflineApps]    = useState([]);
    const [pendingCount,   setPendingCount]   = useState(0);

    useEffect(() => {
        // Initial read — subsequent updates come from onDraftChange callback
        setDraftCount(getDrafts().length);
        const info = getCacheInfo();
        setCacheInfo(info);
        if (info) {
            const cache = getCache();
            const apps  = cache?.applications || [];
            setOfflineApps(apps);
            // Auto-select first app when offline after page refresh
            if (!isOnline && apps.length > 0 && !selectedCode) {
                const first = apps[0];
                setSelectedCode(first.ciReferenceCode);
                setSearchResult({ success: true, application: first, investigation: null });
            }
        }
    }, [getDrafts, getCacheInfo, getCache, isOnline]);

    useEffect(() => {
        if (!isOnline) return;
        fetchWrapper.get(getApiBaseUrl() + 'laf/applications/list?status=pending')
            .then(r => { if (r.success) setPendingCount(r.applications?.length ?? 0); })
            .catch(() => {});
    }, [isOnline, listRefreshKey]);

    const loadApplication = useCallback(async (ciCode) => {
        setSelectedCode(ciCode);
        if (!isOnline) {
            const cache = getCache();
            const app   = cache?.applications?.find(a => a.ciReferenceCode === ciCode);
            if (app) setSearchResult({ success: true, application: app, investigation: null });
            else toast.error('Application not found in offline cache.');
            return;
        }
        setLoadingDetail(true);
        setSearchResult(null);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + `laf/ci/${encodeURIComponent(ciCode)}`);
            if (!res.success) { toast.error(res.message || 'Application not found.'); return; }
            setSearchResult(res);
        } catch { toast.error('Failed to load application.'); }
        finally { setLoadingDetail(false); }
    }, [isOnline, getCache]);

    const handleSync = useCallback(async () => {
        const drafts = getDrafts();
        if (!drafts.length) return;
        setSyncing(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'laf/ci/offline-sync', { drafts });
            if (res.success) {
                res.results.forEach(r => { if (r.success) removeDraft(r.ciReferenceCode); });
                const failed = res.results.filter(r => !r.success).length;
                toast.success(failed === 0 ? `${drafts.length} draft(s) synced.` : `${drafts.length - failed} synced, ${failed} failed.`);
                const remaining = getDrafts().length;
                setDraftCount(remaining);
                if (remaining === 0) { clearCache(); setCacheInfo(null); setOfflineApps([]); }
                setListRefreshKey(k => k + 1);
            } else { toast.error('Sync failed.'); }
        } catch { toast.error('Sync error. Check connection.'); }
        finally { setSyncing(false); }
    }, [getDrafts, removeDraft, clearCache]);

    const handleSaved = useCallback(({ offline }) => {
        if (!offline && searchResult?.application?.ciReferenceCode) {
            loadApplication(searchResult.application.ciReferenceCode);
            setListRefreshKey(k => k + 1);
        } else if (offline) {
            setDraftCount(getDrafts().length);
        }
    }, [searchResult, loadApplication, getDrafts]);

    const handleCached = useCallback(() => {
        const info = getCacheInfo();
        setCacheInfo(info);
        const cache = getCache();
        setOfflineApps(cache?.applications || []);
    }, [getCacheInfo, getCache]);

    const isLO      = currentUser?.role?.rep === 4;
    const allowLoCI = systemSettings?.allowLoCI ?? false;

    if (isLO && !allowLoCI) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Access Restricted</h2>
                    <p className="text-sm text-gray-500 text-center max-w-sm">
                        Loan Officers are not currently authorized to conduct CI Investigations. Please contact your Branch Manager.
                    </p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="px-4 py-6">

                {/* Page header + Prepare for Field Work button */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">CI Investigation</h1>
                        <p className="text-sm text-gray-500 mt-1">Select an application from the list or search by CI reference code</p>
                    </div>
                    {isOnline && (
                        <button type="button" onClick={() => setFieldModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex-shrink-0">
                            <Briefcase className="w-4 h-4" />
                            Prepare for Field Work
                        </button>
                    )}
                </div>

                {/* Pre-leave reminder banner — online + pending apps + no cache */}
                {isOnline && pendingCount > 0 && !cacheInfo && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <Briefcase className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-800">Heading out for field investigations?</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                You have <strong>{pendingCount}</strong> pending application{pendingCount !== 1 ? 's' : ''}.
                                Tap <strong>"Prepare for Field Work"</strong> to select and download them to your device before you lose internet access.
                            </p>
                        </div>
                        <button type="button" onClick={() => setFieldModalOpen(true)}
                            className="flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors">
                            Prepare Now
                        </button>
                    </div>
                )}

                {/* Cache info banner — shows when cache exists */}
                {cacheInfo && (
                    <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Briefcase className="w-4 h-4 text-teal-600" />
                        </div>
                        <div className="flex-1 text-xs text-teal-700">
                            <strong>{cacheInfo.count} applications</strong> cached for field work · Saved {moment(cacheInfo.cachedAt).fromNow()}
                            {!isOnline && <span className="ml-1 font-semibold text-amber-700">(offline mode)</span>}
                        </div>
                        {isOnline && draftCount === 0 && (
                            <button type="button" onClick={() => { clearCache(); setCacheInfo(null); setOfflineApps([]); }}
                                className="flex-shrink-0 text-xs text-teal-500 hover:text-teal-700 underline underline-offset-2">
                                Clear cache
                            </button>
                        )}
                    </div>
                )}

                {/* Offline draft sync banner */}
                <OfflineDraftBanner isOnline={isOnline} draftCount={draftCount} onSync={handleSync} syncing={syncing} />

                {/* Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">

                    <div className="lg:col-span-4">
                        <ApplicationsList
                            onSelect={loadApplication}
                            selectedCode={selectedCode}
                            refreshKey={listRefreshKey}
                            offlineApps={offlineApps}
                            isOnline={isOnline}
                            getDrafts={getDrafts}
                        />
                    </div>

                    <div className="lg:col-span-8 space-y-4">
                        {isOnline && (
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Or search by CI Reference Code</p>
                                <CISearchForm onFound={(res) => setSearchResult(res)} />
                            </div>
                        )}

                        {loadingDetail && <div className="flex justify-center py-12"><Spinner /></div>}

                        {!loadingDetail && !searchResult && (
                            <div className="text-center py-20 text-gray-300">
                                <ChevronRight className="w-12 h-12 mx-auto mb-3 text-gray-200 rotate-180" />
                                <p className="text-sm text-gray-400">Select an application from the list</p>
                                {isOnline && <p className="text-xs text-gray-300 mt-1">or enter a CI Reference Code above</p>}
                            </div>
                        )}

                        {!loadingDetail && searchResult && (
                            <>
                                {searchResult.application?.status === 'promoted' && (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="text-sm font-semibold text-blue-800">This application has already been promoted to a client record.</p>
                                    </div>
                                )}
                                {searchResult.application?.status === 'ci_declined' && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <p className="text-sm font-semibold text-red-800">Previously declined. You can update the investigation below.</p>
                                    </div>
                                )}
                                {isOnline && (
                                    <div className="flex justify-end">
                                        <button onClick={() => setLafModalOpen(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                                            <Printer className="w-4 h-4" />Print / Download LAF
                                        </button>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    <div className="space-y-4">
                                        <ApplicantCard application={searchResult.application} />
                                        <LAFPhotoCard lafPhotoUrl={searchResult.application?.lafPhotoUrl} />
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Investigation Form</h3>
                                        {searchResult.investigation && (
                                            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                                                <p className="font-semibold text-gray-700 mb-1">Previous investigation on file</p>
                                                <p>By: {searchResult.investigation.picUserName || '—'}</p>
                                                <p>{searchResult.investigation.investigatedAt ? moment(searchResult.investigation.investigatedAt).format('MMM DD, YYYY h:mm A') : '—'}</p>
                                                <p className="mt-1 italic text-gray-400">Submitting below will update this record.</p>
                                            </div>
                                        )}
                                        <CIReviewPanel
                                            key={selectedCode}
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
                application={{ ...searchResult?.application, branchName: searchResult?.application?.branchName, branchCode: searchResult?.application?.branchCode }}
            />

            <PrepareForFieldModal
                isOpen={fieldModalOpen}
                onClose={() => setFieldModalOpen(false)}
                currentUser={currentUser}
                onCached={handleCached}
            />
        </Layout>
    );
};

export default CIInvestigationPage;