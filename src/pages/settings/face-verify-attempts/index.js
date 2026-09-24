// src/pages/settings/face-verify-attempts/index.js
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import moment from 'moment';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import PhotoComparisonOverlay, { PhotoThumb } from '@/components/shared/PhotoComparisonOverlay';
import { ExternalLink } from 'lucide-react';

const PAGE_SIZE = 25;
const MATCH_FILTERS = [
    { value: '', label: 'All' },
    { value: 'false', label: 'Mismatches only' },
    { value: 'true', label: 'Matches only' },
];

const FaceVerifyAttemptsPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const router = useRouter();

    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [matchedFilter, setMatchedFilter] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    // CHANGED: was `preview` (a single url string) — now holds the whole
    // attempt row so the overlay can show both enrolled + captured together.
    const [zoomAttempt, setZoomAttempt] = useState(null);

    useEffect(() => {
        if (currentUser && !currentUser.root) router.replace('/');
    }, [currentUser, router]);

    useEffect(() => {
        const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: PAGE_SIZE });
            if (matchedFilter) params.set('matched', matchedFilter);
            if (search) params.set('search', search);
            const res = await fetchWrapper.get(getApiBaseUrl() + 'face-verify-attempts/list?' + params.toString());
            if (!res.success) return;
            setAttempts(res.attempts);
            setTotal(res.total);
        } finally {
            setLoading(false);
        }
    }, [page, matchedFilter, search]);

    useEffect(() => { load(); }, [load]);

    const capturedKeys   = attempts.map(a => a.photo_key).filter(Boolean);
    const enrollmentKeys = attempts.map(a => a.clientEnrollmentPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls([...capturedKeys, ...enrollmentKeys]);

    if (!currentUser?.root) return null;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <Layout>
            {/* FIX: no outer bg/padding wrapper — Layout already provides both
                (bg-neutral-200 + p-6). Adding our own here was fighting it,
                producing double padding and a mismatched gray. */}
            <div className="max-w-5xl mx-auto">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Face Verification Attempts</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Enrollment photo vs. captured frame at each verification attempt
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-3">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search by name or CI reference code..."
                        className="flex-1 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={matchedFilter}
                        onChange={(e) => { setPage(1); setMatchedFilter(e.target.value); }}
                        className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white"
                    >
                        {MATCH_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : attempts.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
                        No attempts recorded yet.
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                        {attempts.map((a) => {
                            const enrollUrl = a.clientEnrollmentPhotoKey ? urlMap[a.clientEnrollmentPhotoKey] : null;
                            const captureUrl = a.photo_key ? urlMap[a.photo_key] : null;
                            return (
                                <div key={a._id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {/* CHANGED: both thumbnails now open the same side-by-side
                                            comparison overlay, not a single enlarged image each */}
                                        <PhotoThumb url={enrollUrl} label="Enrolled" onClick={() => setZoomAttempt(a)} />
                                        <span className="text-gray-300 text-xs">vs</span>
                                        <PhotoThumb url={captureUrl} label="Captured" onClick={() => setZoomAttempt(a)} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {a.clientName || <span className="font-mono text-xs text-gray-400">{a.client_id}</span>}
                                        </p>
                                        {a.ci_reference_code ? (
                                            <a
                                                href={`/transactions/ci-investigation?code=${a.ci_reference_code}`}
                                                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-mono mt-0.5"
                                            >
                                                {a.ci_reference_code}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-300">No CI reference logged</span>
                                        )}
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {moment.utc(a.captured_at).local().format('MMM D, YYYY h:mm A')}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-6 flex-shrink-0">
                                        <div className="text-center w-16">
                                            <p className="text-xs text-gray-400">Distance</p>
                                            <p className="text-sm font-semibold tabular-nums text-gray-800">
                                                {a.distance != null ? a.distance.toFixed(3) : '—'}
                                            </p>
                                        </div>
                                        <div className="text-center w-16">
                                            <p className="text-xs text-gray-400">Confidence</p>
                                            <p className="text-sm font-semibold tabular-nums text-gray-800">
                                                {a.confidence != null ? `${a.confidence.toFixed(1)}%` : '—'}
                                            </p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            a.matched ? 'bg-green-50 text-green-700 border border-green-200'
                                                      : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>
                                            {a.matched ? 'Matched' : 'Mismatch'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 mt-4">
                    <span>Page {page} of {totalPages} ({total} total)</span>
                    <div className="flex gap-2">
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 bg-white hover:bg-gray-50">Previous</button>
                        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 bg-white hover:bg-gray-50">Next</button>
                    </div>
                </div>
            </div>

            {/* CHANGED: replaced single-image preview modal with a side-by-side
                comparison overlay, matching CIDuplicatePanel's pattern */}
            {zoomAttempt && (
                <PhotoComparisonOverlay
                    leftUrl={zoomAttempt.clientEnrollmentPhotoKey ? urlMap[zoomAttempt.clientEnrollmentPhotoKey] : null}
                    rightUrl={zoomAttempt.photo_key ? urlMap[zoomAttempt.photo_key] : null}
                    leftLabel="Enrolled"
                    rightLabel="Captured"
                    title={`Photo Comparison — ${zoomAttempt.clientName || zoomAttempt.client_id}`}
                    onClose={() => setZoomAttempt(null)}
                />
            )}
        </Layout>
    );
};

export default FaceVerifyAttemptsPage;