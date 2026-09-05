// src/components/ci/CIDuplicateQueue.js
import React, { useState, useEffect, useCallback } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import CIDuplicatePanel from './CIDuplicatePanel';
import Spinner from '@/components/Spinner';
import moment from 'moment';
import { ChevronRight, AlertTriangle } from 'lucide-react';

const CIDuplicateQueue = ({ onCountChange }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [selected, setSelected]         = useState(null);

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'laf/pending-validation-list');
            if (res.success) {
                setApplications(res.applications || []);
                onCountChange?.(res.total ?? res.applications?.length ?? 0);
            }
        } catch { /* fail quiet, list stays empty */ }
        finally { setLoading(false); }
    }, [onCountChange]);

    useEffect(() => { loadList(); }, [loadList]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT — list, matches CIApplicationsList styling */}
            <div className="lg:col-span-4">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Flagged Applications
                        </p>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
                        {loading ? (
                            <div className="flex justify-center py-10"><Spinner /></div>
                        ) : applications.length === 0 ? (
                            <div className="py-10 px-4 text-center">
                                <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">No flagged applications.</p>
                            </div>
                        ) : applications.map(app => (
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
                    </div>
                </div>
            </div>

            {/* RIGHT — detail, matches main tab's empty/detail split */}
            <div className="lg:col-span-8">
                {selected ? (
                    <CIDuplicatePanel
                        application={selected}
                        onValidated={() => { setSelected(null); loadList(); }}
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
    );
};

export default CIDuplicateQueue;