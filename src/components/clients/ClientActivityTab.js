// src/components/clients/ClientActivityTab.js
// "Activity" tab inside ClientDetailPage — self-fetching, same pattern as LafCiHistoryTab.js.
// Pulls a sanitized timeline from /api/v2/clients/activity (LAF, CI, face verification/re-enrollment, loan, client edits).

import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import { ClockIcon, ExclamationTriangleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import Spinner from '../Spinner';

const FILTERS = [
    { id: '',          label: 'All' },
    { id: 'BIOMETRIC', label: 'Face' },
    { id: 'LAF',       label: 'LAF' },
    { id: 'CI',        label: 'CI' },
    { id: 'LOAN',      label: 'Loan' },
    { id: 'CLIENT',    label: 'Client' },
];

const CATEGORY_STYLES = {
    BIOMETRIC: 'bg-purple-100 text-purple-800',
    LAF:       'bg-blue-100 text-blue-800',
    CI:        'bg-teal-100 text-teal-800',
    LOAN:      'bg-green-100 text-green-800',
    CLIENT:    'bg-gray-100 text-gray-700',
    DISBURSEMENT: 'bg-green-100 text-green-800',
};

const humanize = (action) => {
    const s = String(action || '').replace(/_/g, ' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

function SeverityIcon({ severity, success }) {
    if (success === false) return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
    if (severity === 'CRITICAL') return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
    if (severity === 'WARNING') return <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />;
    return <ClockIcon className="w-5 h-5 text-gray-400" />;
}

function EventRow({ event, photoUrl }) {
    return (
        <li className="flex gap-3 py-4">
            <div className="flex-shrink-0 mt-0.5"><SeverityIcon severity={event.severity} success={event.success} /></div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${CATEGORY_STYLES[event.category] || 'bg-gray-100 text-gray-700'}`}>
                        {event.category}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{humanize(event.action)}</span>
                    {event.success === false && <span className="text-xs font-medium text-red-600">Failed</span>}
                </div>
                {event.description && <p className="mt-1 text-sm text-gray-600 break-words">{event.description}</p>}
                {event.meta?.reason && (
                    <p className="mt-1 text-xs text-amber-700 italic">Reason: {event.meta.reason}</p>
                )}
                {event.failReason && <p className="mt-1 text-xs text-red-600">{event.failReason}</p>}
                <p className="mt-1 text-xs text-gray-400">
                    {[event.actor, event.actorRole, event.branchName].filter(Boolean).join(' · ') || '—'}
                </p>
            </div>
            {photoUrl && (
                <button type="button" onClick={() => window.open(photoUrl, '_blank', 'noopener')} className="flex-shrink-0">
                    <img src={photoUrl} alt="Captured" className="w-10 h-10 rounded border object-cover" />
                </button>
            )}
            <div className="flex-shrink-0 text-right text-xs text-gray-400 whitespace-nowrap">
                {moment(event.timestamp).format('MMM DD, YYYY')}
                <br />
                {moment(event.timestamp).format('h:mm A')}
            </div>
        </li>
    );
}

const ClientActivityTab = ({ client }) => {
    const [events, setEvents]           = useState([]);
    const [loading, setLoading]         = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore]         = useState(false);
    const [nextBefore, setNextBefore]   = useState(null);
    const [category, setCategory]       = useState('');
    const [includeViews, setIncludeViews] = useState(false);
    const [error, setError]             = useState(null);

    const fetchPage = useCallback(async (before) => {
        const params = new URLSearchParams({ clientId: client._id, limit: '30' });
        if (before) params.set('before', before);
        if (category) params.set('category', category);
        if (includeViews) params.set('includeViews', 'true');
        return fetchWrapper.get(getApiBaseUrl() + 'clients/activity?' + params.toString());
    }, [client?._id, category, includeViews]);

    useEffect(() => {
        if (!client?._id) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchPage(null)
            .then(res => {
                if (cancelled) return;
                if (res.success) {
                    setEvents(res.events || []);
                    setHasMore(!!res.hasMore);
                    setNextBefore(res.nextBefore || null);
                } else {
                    setEvents([]); setHasMore(false); setNextBefore(null);
                    setError(res.message || 'Failed to load activity.');
                }
            })
            .catch(() => { if (!cancelled) { setEvents([]); setError('Failed to load activity.'); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [client?._id, fetchPage]);

    const loadMore = async () => {
        if (!nextBefore || loadingMore) return;
        setLoadingMore(true);
        try {
            const res = await fetchPage(nextBefore);
            if (res.success) {
                setEvents(prev => [...prev, ...(res.events || [])]);
                setHasMore(!!res.hasMore);
                setNextBefore(res.nextBefore || null);
            }
        } finally {
            setLoadingMore(false);
        }
    };

    const photoKeys = events.map(e => e.photoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center">
                        <ClockIcon className="w-5 h-5 text-gray-400 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Activity</h3>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={includeViews} onChange={e => setIncludeViews(e.target.checked)} />
                        Include page views
                    </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {FILTERS.map(f => (
                        <button key={f.id || 'all'} type="button" onClick={() => setCategory(f.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                category === f.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="p-6">
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : error ? (
                    <p className="text-sm text-red-600 text-center py-8">{error}</p>
                ) : events.length === 0 ? (
                    <div className="text-center py-8">
                        <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No activity recorded</h3>
                        <p className="text-gray-500">Nothing has been logged for this client yet.</p>
                    </div>
                ) : (
                    <>
                        <ul className="divide-y divide-gray-100">
                            {events.map(e => (
                                <EventRow key={e.id} event={e} photoUrl={e.photoKey ? urlMap[e.photoKey] : null} />
                            ))}
                        </ul>
                        {hasMore && (
                            <div className="pt-4 text-center">
                                <button type="button" onClick={loadMore} disabled={loadingMore}
                                    className="px-4 py-2 text-sm font-medium text-primary-1 bg-primary-4 rounded-md hover:bg-primary-3 disabled:opacity-50">
                                    {loadingMore ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ClientActivityTab;