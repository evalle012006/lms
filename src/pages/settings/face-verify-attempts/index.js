// src/pages/settings/face-verify-attempts/index.js
// Root-only debug view: browse face verification attempts (match/mismatch)
// with distance, confidence, and a thumbnail of what was captured.

import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import moment from 'moment';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

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
    const [thumbUrls, setThumbUrls] = useState({});
    const [clientNames, setClientNames] = useState({}); // clientId -> display name
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [matchedFilter, setMatchedFilter] = useState('');
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        if (currentUser && !currentUser.root) {
            router.replace('/');
        }
    }, [currentUser, router]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: PAGE_SIZE });
            if (matchedFilter) params.set('matched', matchedFilter);

            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'face-verify-attempts/list?' + params.toString()
            );
            if (!res.success) return;

            setAttempts(res.attempts);
            setTotal(res.total);

            // Thumbnails
            const keys = res.attempts.map((a) => a.photo_key).filter(Boolean);
            if (keys.length) {
                const signed = await fetch('/api/signed-url-bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keys }),
                }).then((r) => r.json());
                setThumbUrls((prev) => ({ ...prev, ...(signed.urlMap || {}) }));
            }

            // Client names — dedupe, only fetch ones we don't already have.
            const uniqueIds = [...new Set(res.attempts.map((a) => a.client_id).filter(Boolean))];
            const missingIds = uniqueIds.filter((id) => !clientNames[id]);
            if (missingIds.length) {
                if (missingIds.length > 20) {
                    // by-ids silently truncates past 20 — log so this doesn't
                    // fail invisibly if it ever actually happens.
                    console.warn(
                        `[face-verify-attempts] ${missingIds.length} unique client IDs on this page, ` +
                        `but clients/by-ids only returns the first 20 — some names will fall back to raw IDs.`
                    );
                }
                const byIdsRes = await fetchWrapper.post(
                    getApiBaseUrl() + 'clients/by-ids',
                    { ids: missingIds }
                );
                if (byIdsRes?.success) {
                    const nameMap = {};
                    byIdsRes.clients.forEach((c) => {
                        nameMap[c._id] = `${c.firstName} ${c.lastName}`.trim();
                    });
                    setClientNames((prev) => ({ ...prev, ...nameMap }));
                }
            }
        } finally {
            setLoading(false);
        }
    }, [page, matchedFilter]); // eslint-disable-line react-hooks/exhaustive-deps
    // NOTE: clientNames intentionally excluded from deps — including it would
    // re-trigger load() every time we resolve names, causing an infinite loop.

    useEffect(() => { load(); }, [load]);

    if (!currentUser?.root) return null;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <Layout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold text-gray-800">
                        Face Verification Attempts
                    </h1>
                    <select
                        value={matchedFilter}
                        onChange={(e) => { setPage(1); setMatchedFilter(e.target.value); }}
                        className="border border-gray-300 rounded-lg text-sm px-3 py-1.5"
                    >
                        {MATCH_FILTERS.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <Spinner />
                ) : (
                    <>
                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Thumbnail</th>
                                        <th className="px-3 py-2 text-left">Client</th>
                                        <th className="px-3 py-2 text-left">Distance</th>
                                        <th className="px-3 py-2 text-left">Confidence</th>
                                        <th className="px-3 py-2 text-left">Result</th>
                                        <th className="px-3 py-2 text-left">Captured</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {attempts.map((a) => (
                                        <tr key={a._id}>
                                            <td className="px-3 py-2">
                                                {a.photo_key && thumbUrls[a.photo_key] ? (
                                                    <img
                                                        src={thumbUrls[a.photo_key]}
                                                        alt="capture"
                                                        className="w-16 h-12 object-cover rounded cursor-pointer"
                                                        onClick={() => setPreview(thumbUrls[a.photo_key])}
                                                    />
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="text-gray-800">
                                                    {clientNames[a.client_id] || (
                                                        <span className="font-mono text-xs text-gray-400">
                                                            {a.client_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 tabular-nums">
                                                {a.distance != null ? a.distance.toFixed(3) : '—'}
                                            </td>
                                            <td className="px-3 py-2 tabular-nums">
                                                {a.confidence != null ? `${a.confidence.toFixed(1)}%` : '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    a.matched
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {a.matched ? 'Matched' : 'Mismatch'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 text-xs">
                                                {moment.utc(a.captured_at).local().format('MMM D, YYYY h:mm A')}
                                            </td>
                                        </tr>
                                    ))}
                                    {attempts.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">
                                                No attempts recorded yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>Page {page} of {totalPages} ({total} total)</span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {preview && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
                        onClick={() => setPreview(null)}
                    >
                        <img src={preview} alt="full capture" className="max-w-2xl max-h-[80vh] rounded-lg" />
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FaceVerifyAttemptsPage;