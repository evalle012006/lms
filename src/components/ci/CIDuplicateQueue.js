// src/components/ci/CIDuplicateQueue.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import CIDuplicatePanel from './CIDuplicatePanel';
import Spinner from '@/components/Spinner';
import moment from 'moment';
import { ChevronRight, AlertTriangle, Search } from 'lucide-react';

const PAGE_SIZE = 20;

const CIDuplicateQueue = ({ onCountChange }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [loadingMore, setLoadingMore]   = useState(false);
    const [hasMore, setHasMore]           = useState(false);
    const [selected, setSelected]         = useState(null);
    const [search, setSearch]             = useState('');
    const debounceRef = useRef(null);

    const loadList = useCallback(async (searchTerm, reset = true) => {
        if (reset) setLoading(true); else setLoadingMore(true);
        try {
            const offset = reset ? 0 : applications.length;
            const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
            if (searchTerm?.trim()) params.set('search', searchTerm.trim());

            const res = await fetchWrapper.get(getApiBaseUrl() + `laf/pending-validation-list?${params}`);
            if (res.success) {
                setApplications(prev => reset ? (res.applications || []) : [...prev, ...(res.applications || [])]);
                setHasMore(!!res.hasMore);
                if (reset) onCountChange?.(res.total ?? res.applications?.length ?? 0);
            }
        } catch { /* fail quiet */ }
        finally { setLoading(false); setLoadingMore(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applications.length, onCountChange]);

    // Initial load
    useEffect(() => { loadList(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadList(search, true), 350);
        return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT — list */}
            <div className="lg:col-span-4">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Flagged Applications
                        </p>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search name or CI code…"
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg
                                    focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                    </div>
                    <div className="max-h-[65vh] overflow-y-auto divide-y divide-gray-100">
                        {loading ? (
                            <div className="flex justify-center py-10"><Spinner /></div>
                        ) : applications.length === 0 ? (
                            <div className="py-10 px-4 text-center">
                                <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">
                                    {search ? 'No matches found.' : 'No flagged applications.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {applications.map(app => (
                                    <button key={app.ciReferenceCode} type="button"
                                        onClick={() => setSelected(app)}
                                        className={`w-full text-left px-4 py-3 transition-colors ${
                                            selected?.ciReferenceCode === app.ciReferenceCode
                                                ? 'bg-orange-50 border-l-4 border-orange-500'
                                                : 'border-l-4 border-transparent hover:bg-gray-50'
                                        }`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {app.lastName}, {app.firstName}
                                            </p>
                                            {app.isExactDuplicateMatch && (
                                                <span className="flex-shrink-0 px-1.5 py-0.5 bg-red-100 text-red-700
                                                    text-[10px] font-bold rounded uppercase">
                                                    Exact
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5 font-mono">
                                            {app.ciReferenceCode}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {moment(app.submittedAt).format('MMM D, YYYY')}
                                        </p>
                                    </button>
                                ))}
                                {hasMore && (
                                    <button type="button" onClick={() => loadList(search, false)}
                                        disabled={loadingMore}
                                        className="w-full py-3 text-xs font-medium text-blue-600 hover:bg-blue-50
                                            disabled:opacity-50 transition-colors">
                                        {loadingMore ? 'Loading…' : 'Load more'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT — detail */}
            <div className="lg:col-span-8">
                <div className="bg-white rounded-xl border border-gray-200 min-h-[400px]">
                    {selected ? (
                        <CIDuplicatePanel
                            application={selected}
                            onValidated={() => { setSelected(null); loadList(search, true); }}
                        />
                    ) : (
                        <div className="text-center py-20 text-gray-300">
                            <ChevronRight className="w-12 h-12 mx-auto mb-3 text-gray-200 rotate-180" />
                            <p className="text-sm text-gray-400">
                                Select a flagged application from the list
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CIDuplicateQueue;