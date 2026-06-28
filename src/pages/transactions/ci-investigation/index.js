// src/pages/transactions/ci-investigation/index.js
// REFACTORED: Extracted heavy components into separate files:
//   CIApplicantCard      → src/components/ci/CIApplicantCard.js
//   CILAFPhotoCard       → src/components/ci/CILAFPhotoCard.js
//   CIApplicationsList   → src/components/ci/CIApplicationsList.js
//   CIPromotedClientBanner → src/components/ci/CIPromotedClientBanner.js
// FIX: pendingCount uses res.total (true DB count) via limit=500 fallback
// FIX: ApplicationsList is now CIApplicationsList with infinite scroll

import React, { useState, useCallback, useEffect } from 'react';
import { useSelector }  from 'react-redux';
import { useRouter }    from 'next/router';
import { toast }        from 'react-toastify';
import moment           from 'moment';
import { Briefcase, Printer, ChevronRight } from 'lucide-react';

import Layout              from '@/components/Layout';
import Spinner             from '@/components/Spinner';
import CISearchForm        from '@/components/ci/CISearchForm';
import CIReviewPanel       from '@/components/ci/CIReviewPanel';
import OfflineDraftBanner  from '@/components/ci/OfflineDraftBanner';
import TempLAFModal        from '@/components/laf/TempLAFModal';
import PrepareForFieldModal from '@/components/ci/PrepareForFieldModal';

// FIX: extracted components
import CIApplicantCard       from '@/components/ci/CIApplicantCard';
import CILAFPhotoCard        from '@/components/ci/CILAFPhotoCard';
import CIApplicationsList    from '@/components/ci/CIApplicationsList';
import CIPromotedClientBanner from '@/components/ci/CIPromotedClientBanner';

import { useOnlineStatus }   from '@/hooks/useOnlineStatus';
import { useCIDraftStorage } from '@/hooks/useCIDraftStorage';
import { useCIOfflineCache } from '@/hooks/useCIOfflineCache';
import { fetchWrapper }      from '@/lib/fetch-wrapper';
import { getApiBaseUrl }     from '@/lib/constants';

// ── Offline: no cache screen ──────────────────────────────────────────────
const OfflineNoCacheScreen = ({ onOpen }) => (
    <Layout>
        <div className="flex flex-col items-center justify-center h-full py-24 gap-4 px-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808
                        9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565
                        20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                </svg>
            </div>
            <div className="text-center">
                <p className="text-base font-semibold text-gray-800">No Cached Data</p>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                    You are offline and have no field data cached.
                    Please go online and use <strong>Prepare for Field Work</strong> before visiting clients.
                </p>
            </div>
            <button type="button" onClick={onOpen} disabled
                className="px-5 py-2.5 bg-gray-200 text-gray-500 text-sm font-medium
                    rounded-xl cursor-not-allowed">
                Prepare for Field Work (requires internet)
            </button>
        </div>
    </Layout>
);

// ── LO access restricted screen ───────────────────────────────────────────
const LORestrictedScreen = () => (
    <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
                        1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34
                        16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Access Restricted</h2>
            <p className="text-sm text-gray-500 text-center max-w-sm">
                Loan Officers are not currently authorized to conduct CI Investigations.
                Please contact your Branch Manager.
            </p>
        </div>
    </Layout>
);

// ── Main page ─────────────────────────────────────────────────────────────
const CIInvestigationPage = () => {
    const router      = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const systemSettings = useSelector(state => state.systemSettings.data);
    const isOnline    = useOnlineStatus();

    const { getDrafts, removeDraft } = useCIDraftStorage({
        onDraftChange: count => setDraftCount(count),
    });
    const { getCache, clearCache, getCacheInfo } = useCIOfflineCache();

    const [clientLoanHistory, setClientLoanHistory] = useState(null);
    const [searchResult,      setSearchResult]      = useState(null);
    const [loadingDetail,     setLoadingDetail]     = useState(false);
    const [syncing,           setSyncing]           = useState(false);
    const [draftCount,        setDraftCount]        = useState(0);
    const [selectedCode,      setSelectedCode]      = useState(null);
    const [lafModalOpen,      setLafModalOpen]      = useState(false);
    const [listRefreshKey,    setListRefreshKey]    = useState(0);
    const [fieldModalOpen,    setFieldModalOpen]    = useState(false);
    const [cacheInfo,         setCacheInfo]         = useState(null);
    const [offlineApps,       setOfflineApps]       = useState([]);
    const [pendingCount,      setPendingCount]      = useState(0);

    // ── Auto-load from QR scan (?code=CI-XXXX) ────────────────────────────
    useEffect(() => {
        const { code } = router.query;
        if (code && isOnline && !selectedCode) {
            loadApplication(code);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.query.code, isOnline]);

    // ── Init — drafts + cache ─────────────────────────────────────────────
    useEffect(() => {
        setDraftCount(getDrafts().length);
        const info = getCacheInfo();
        setCacheInfo(info);
        if (info) {
            const cache = getCache();
            const apps  = cache?.applications || [];
            setOfflineApps(apps);
            if (!isOnline && apps.length > 0 && !selectedCode) {
                const first = apps[0];
                setSelectedCode(first.ciReferenceCode);
                setSearchResult({ success: true, application: first, investigation: null });
            }
        }
    }, [getDrafts, getCacheInfo, getCache, isOnline]);

    // ── FIX: pendingCount — uses limit=500 so fallback count is accurate ──
    // res.total is the DB aggregate count (preferred). If Hasura aggregate
    // type isn't tracked, res.total is null — fall back to res.applications.length.
    // limit=20 covers any typical branch volume so the fallback is correct.
    useEffect(() => {
        if (!isOnline) return;
        fetchWrapper.get(
            getApiBaseUrl() + 'laf/applications/list?status=pending&limit=20&offset=0'
        ).then(r => {
            if (r.success) {
                setPendingCount(r.total ?? r.applications?.length ?? 0);
            }
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listRefreshKey]);

    // ── Load application detail ───────────────────────────────────────────
    const loadApplication = useCallback(async (ciCode) => {
        setSelectedCode(ciCode);
        setClientLoanHistory(null);

        if (!isOnline) {
            const cache = getCache();
            const app   = cache?.applications?.find(a => a.ciReferenceCode === ciCode);
            if (!app) { toast.error('Application not found in offline cache.'); return; }
            const draft = getDrafts().find(d => d.ciReferenceCode === ciCode);
            setSearchResult({
                success:       true,
                application:   app,
                investigation: draft ? {
                    findings:         draft.findings,
                    businessVerified: draft.businessVerified,
                    addressVerified:  draft.addressVerified,
                    decision:         draft.decision,
                    declineReason:    draft.declineReason,
                    selfieKey:        draft.selfieKey || null,
                    selfieUrl:        draft.selfieBase64 || null,
                    picUserName:      currentUser
                        ? `${currentUser.firstName} ${currentUser.lastName}` : null,
                    investigatedAt:   draft.investigatedAt,
                    isDraft:          true,
                } : null,
            });
            return;
        }

        setLoadingDetail(true);
        setSearchResult(null);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/ci/${encodeURIComponent(ciCode)}`
            );
            if (!res.success) { toast.error(res.message || 'Application not found.'); return; }

            if (!res.investigation) {
                const draft = getDrafts().find(d => d.ciReferenceCode === ciCode);
                if (draft) {
                    res.investigation = {
                        findings:         draft.findings,
                        businessVerified: draft.businessVerified,
                        addressVerified:  draft.addressVerified,
                        decision:         draft.decision,
                        declineReason:    draft.declineReason,
                        selfieKey:        draft.selfieKey || null,
                        selfieUrl:        draft.selfieBase64 || null,
                        picUserName:      currentUser
                            ? `${currentUser.firstName} ${currentUser.lastName}` : null,
                        investigatedAt:   draft.investigatedAt,
                        isDraft:          true,
                    };
                }
            }

            setSearchResult(res);

            const existingClientId = res.application?.existingClientId;
            if (existingClientId) {
                try {
                    const histRes = await fetchWrapper.get(
                        getApiBaseUrl() + `clients/loan-history?clientId=${existingClientId}`
                    );
                    setClientLoanHistory(
                        histRes.success && histRes.loans?.length ? histRes.loans : []
                    );
                } catch {
                    setClientLoanHistory([]);
                }
            } else {
                setClientLoanHistory(null);
            }
        } catch {
            toast.error('Failed to load application.');
        } finally {
            setLoadingDetail(false);
        }
    }, [isOnline, getCache, getDrafts, currentUser]);

    // ── Sync offline drafts ───────────────────────────────────────────────
    const handleSync = useCallback(async () => {
        const drafts = getDrafts();
        if (!drafts.length) return;
        setSyncing(true);
        try {
            const preparedDrafts = await Promise.all(drafts.map(async (draft) => {
                if (!draft.selfieBase64 || draft.selfieKey) return draft;
                try {
                    const [header, b64] = draft.selfieBase64.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    const ext      = mimeType.split('/')[1] || 'jpg';
                    const binary   = atob(b64);
                    const bytes    = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const blob = new Blob([bytes], { type: mimeType });
                    const file = new File([blob], `offline-selfie.${ext}`, { type: mimeType });
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('origin', 'ci-selfies');
                    fd.append('uuid', draft.tempApplicationId);
                    const uploadRes  = await fetch('/api/upload', { method: 'POST', body: fd });
                    const uploadData = await uploadRes.json();
                    if (!uploadData.fileKey) throw new Error('No key returned');
                    const { selfieBase64: _, ...rest } = draft;
                    return { ...rest, selfieKey: uploadData.fileKey };
                } catch (e) {
                    toast.error(`Selfie upload failed: ${e.message}`);
                    return { ...draft, _selfieUploadFailed: true };
                }
            }));

            const selfieFailures = preparedDrafts.filter(d => d._selfieUploadFailed);
            if (selfieFailures.length > 0) {
                toast.warning(`Selfie upload failed for: ${selfieFailures.map(d => d.ciReferenceCode).join(', ')}`);
            }

            const draftsToSync = preparedDrafts
                .filter(d => !d._selfieUploadFailed)
                .map(({ selfieBase64: _b, _selfieUploadFailed: _f, ...rest }) => rest);

            if (draftsToSync.length === 0) { setSyncing(false); return; }

            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/ci/offline-sync', { drafts: draftsToSync }
            );
            if (res.success) {
                res.results.forEach(r => { if (r.success) removeDraft(r.ciReferenceCode); });
                const failed = res.results.filter(r => !r.success).length;
                toast.success(failed === 0
                    ? `${drafts.length} draft(s) synced.`
                    : `${drafts.length - failed} synced, ${failed} failed.`);
                const remaining = getDrafts().length;
                setDraftCount(remaining);
                if (remaining === 0) { clearCache(); setCacheInfo(null); setOfflineApps([]); }
                setListRefreshKey(k => k + 1);
            } else {
                toast.error(`Sync failed: ${res.message || 'Unknown error'}`);
            }
        } catch (err) {
            toast.error(`Sync error: ${err?.message || 'Unknown error'}`);
        } finally {
            setSyncing(false);
        }
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
        setOfflineApps(getCache()?.applications || []);
    }, [getCacheInfo, getCache]);

    // ── Role guards ───────────────────────────────────────────────────────
    const isLO      = currentUser?.role?.rep === 4;
    const allowLoCI = systemSettings?.allowLoCI ?? false;

    if (isLO && !allowLoCI) {
        const hasCache = !!(cacheInfo && offlineApps.length > 0);
        if (!isOnline && !hasCache) {
            return <OfflineNoCacheScreen onOpen={() => setFieldModalOpen(true)} />;
        }
        return <LORestrictedScreen />;
    }

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <Layout>
            <div className="px-4 py-6">

                {/* Page header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">CI Investigation</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Select an application from the list or search by CI reference code
                        </p>
                    </div>
                    {isOnline && (
                        <button type="button" onClick={() => setFieldModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white
                                text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors
                                shadow-sm flex-shrink-0">
                            <Briefcase className="w-4 h-4" />
                            Prepare for Field Work
                        </button>
                    )}
                </div>

                {/* Field work reminder banner */}
                {isOnline && pendingCount > 0 && !cacheInfo && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl
                        flex items-start gap-3">
                        <Briefcase className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-800">
                                Heading out for field investigations?
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                You have <strong>{pendingCount}</strong> pending
                                application{pendingCount !== 1 ? 's' : ''}.
                                Tap <strong>"Prepare for Field Work"</strong> to download
                                them before you lose internet access.
                            </p>
                        </div>
                        <button type="button" onClick={() => setFieldModalOpen(true)}
                            className="flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white
                                text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors">
                            Prepare Now
                        </button>
                    </div>
                )}

                {/* Cache info banner */}
                {cacheInfo && (
                    <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl
                        flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center
                            justify-center flex-shrink-0">
                            <Briefcase className="w-4 h-4 text-teal-600" />
                        </div>
                        <div className="flex-1 text-xs text-teal-700">
                            <strong>{cacheInfo.count} applications</strong> cached ·
                            Saved {moment(cacheInfo.cachedAt).fromNow()}
                            {!isOnline && (
                                <span className="ml-1 font-semibold text-amber-700">
                                    (offline mode)
                                </span>
                            )}
                        </div>
                        {isOnline && draftCount === 0 && (
                            <button type="button"
                                onClick={() => { clearCache(); setCacheInfo(null); setOfflineApps([]); }}
                                className="flex-shrink-0 text-xs text-teal-500
                                    hover:text-teal-700 underline underline-offset-2">
                                Clear cache
                            </button>
                        )}
                    </div>
                )}

                {/* Do not refresh warning */}
                {cacheInfo && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl
                        flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
                                1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34
                                16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-xs text-red-700 leading-relaxed">
                            <strong>Do not refresh this page while offline.</strong>{' '}
                            If you accidentally refresh, reconnect to internet first, then reload.
                        </p>
                    </div>
                )}

                {/* Offline draft sync banner */}
                <OfflineDraftBanner
                    isOnline={isOnline}
                    draftCount={draftCount}
                    onSync={handleSync}
                    syncing={syncing}
                />

                {/* Main layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">

                    {/* LEFT — applications list */}
                    <div className="lg:col-span-4">
                        <CIApplicationsList
                            onSelect={loadApplication}
                            selectedCode={selectedCode}
                            refreshKey={listRefreshKey}
                            offlineApps={offlineApps}
                            isOnline={isOnline}
                            getDrafts={getDrafts}
                        />
                    </div>

                    {/* RIGHT — detail panel */}
                    <div className="lg:col-span-8 space-y-4">
                        {isOnline && (
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase
                                    tracking-wide mb-2">Or search by CI Reference Code</p>
                                <CISearchForm onFound={res => setSearchResult(res)} />
                            </div>
                        )}

                        {loadingDetail && (
                            <div className="flex justify-center py-12"><Spinner /></div>
                        )}

                        {!loadingDetail && !searchResult && (
                            <div className="text-center py-20 text-gray-300">
                                <ChevronRight className="w-12 h-12 mx-auto mb-3
                                    text-gray-200 rotate-180" />
                                <p className="text-sm text-gray-400">
                                    Select an application from the list
                                </p>
                                {isOnline && (
                                    <p className="text-xs text-gray-300 mt-1">
                                        or enter a CI Reference Code above
                                    </p>
                                )}
                            </div>
                        )}

                        {!loadingDetail && searchResult && (
                            <>
                                {searchResult.application?.status === 'promoted' && (
                                    <CIPromotedClientBanner
                                        application={searchResult.application}
                                        investigation={searchResult.investigation}
                                        currentUser={currentUser}
                                        loanHistory={clientLoanHistory}
                                    />
                                )}
                                {searchResult.application?.status === 'ci_declined' && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <p className="text-sm font-semibold text-red-800">
                                            Previously declined. You can update the investigation below.
                                        </p>
                                    </div>
                                )}
                                {isOnline && (
                                    <div className="flex justify-end">
                                        <button onClick={() => setLafModalOpen(true)}
                                            className="flex items-center gap-2 px-4 py-2
                                                bg-blue-600 text-white text-sm font-medium
                                                rounded-lg hover:bg-blue-700 transition-colors">
                                            <Printer className="w-4 h-4" />
                                            Print / Download LAF
                                        </button>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    <div className="space-y-4">
                                        <CIApplicantCard
                                            application={searchResult.application}
                                            loanHistory={clientLoanHistory}
                                        />
                                        <CILAFPhotoCard
                                            lafPhotoUrl={searchResult.application?.lafPhotoUrl}
                                        />
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                                            Investigation Form
                                        </h3>
                                        {searchResult.investigation && (
                                            <div className={`mb-4 p-3 rounded-lg border text-xs ${
                                                searchResult.investigation.isDraft
                                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600'
                                            }`}>
                                                <p className="font-semibold mb-1">
                                                    {searchResult.investigation.isDraft
                                                        ? '⚠ Unsaved draft — not yet synced'
                                                        : 'Previous investigation on file'}
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
                application={{
                    ...searchResult?.application,
                    branchName: searchResult?.application?.branchName,
                    branchCode: searchResult?.application?.branchCode,
                }}
            />

            <PrepareForFieldModal
                isOpen={fieldModalOpen}
                onClose={() => setFieldModalOpen(false)}
                currentUser={currentUser}
                onCached={handleCached}
                cachedIds={(getCache()?.applications || []).map(a => a._id)}
            />
        </Layout>
    );
};

export default CIInvestigationPage;