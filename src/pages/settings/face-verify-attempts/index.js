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
import { ExternalLink, ImageOff } from 'lucide-react';

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
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        if (currentUser && !currentUser.root) router.replace('/');
    }, [currentUser, router]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: PAGE_SIZE });
            if (matchedFilter) params.set('matched', matchedFilter);
            const res = await fetchWrapper.get(getApiBaseUrl() + 'face-verify-attempts/list?' + params.toString());
            if (!res.success) return;
            setAttempts(res.attempts);
            setTotal(res.total);
        } finally {
            setLoading(false);
        }
    }, [page, matchedFilter]);

    useEffect(() => { load(); }, [load]);

    // FIX: proper authed, cached signed-url fetching via the hook already used elsewhere
    const capturedKeys   = attempts.map(a => a.photo_key).filter(Boolean);
    const enrollmentKeys = attempts.map(a => a.clientEnrollmentPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls([...capturedKeys, ...enrollmentKeys]);

    if (!currentUser?.root) return null;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <Layout>
            <div className="p-6 space-y-4 max-w-6xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">Face Verification Attempts</h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Enrollment photo vs. captured frame at each verification attempt
                        </p>
                    </div>
                    <select
                        value={matchedFilter}
                        onChange={(e) => { setPage(1); setMatchedFilter(e.target.value); }}
                        className="border border-gray-200 rounded-lg text-sm px-3 py-1.5 bg-white"
                    >
                        {MATCH_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Spinner /></div>
                ) : attempts.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
                        No attempts recorded yet.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {attempts.map((a) => {
                            const enrollUrl = a.clientEnrollmentPhotoKey ? urlMap[a.clientEnrollmentPhotoKey] : null;
                            const captureUrl = a.photo_key ? urlMap[a.photo_key] : null;
                            return (
                                <div key={a._id} className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors p-4">
                                    <div className="flex items-center gap-4">
                                        {/* Side-by-side enrollment vs capture */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <PhotoThumb url={enrollUrl} label="Enrolled" onClick={() => setPreview(enrollUrl)} />
                                            <span className="text-gray-300 text-xs">vs</span>
                                            <PhotoThumb url={captureUrl} label="Captured" onClick={() => setPreview(captureUrl)} />
                                        </div>

                                        {/* Client + CI link */}
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

                                        {/* Distance / confidence / result */}
                                        <div className="flex items-center gap-6 flex-shrink-0">
                                            <div className="text-center">
                                                <p className="text-xs text-gray-400">Distance</p>
                                                <p className="text-sm font-semibold tabular-nums text-gray-800">
                                                    {a.distance != null ? a.distance.toFixed(3) : '—'}
                                                </p>
                                            </div>
                                            <div className="text-center">
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
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
                    <span>Page {page} of {totalPages} ({total} total)</span>
                    <div className="flex gap-2">
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                            className="px-3 py-1 border rounded-lg disabled:opacity-40 bg-white">Previous</button>
                        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1 border rounded-lg disabled:opacity-40 bg-white">Next</button>
                    </div>
                </div>
            </div>

            {preview && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setPreview(null)}>
                    <img src={preview} alt="full capture" className="max-w-2xl max-h-[80vh] rounded-lg" />
                </div>
            )}
        </Layout>
    );
};

const PhotoThumb = ({ url, label, onClick }) => (
    <div className="text-center">
        {url ? (
            <img src={url} alt={label} onClick={onClick}
                className="w-14 h-14 rounded-lg object-cover border border-gray-200 cursor-pointer" />
        ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                <ImageOff className="w-4 h-4 text-gray-300" />
            </div>
        )}
        <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
);

export default FaceVerifyAttemptsPage;