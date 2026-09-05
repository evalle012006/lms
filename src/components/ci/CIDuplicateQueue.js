// src/components/ci/CIDuplicateQueue.js
// Lists all temporaryLoanApplications with status='pending_validation'.
// Selecting one loads it into CIDuplicatePanel for resolution.
import React, { useState, useEffect, useCallback } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import CIDuplicatePanel from './CIDuplicatePanel';
import Spinner from '@/components/Spinner';
import moment from 'moment';

const CIDuplicateQueue = ({ onCountChange }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [selected, setSelected]         = useState(null);

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'laf/pending-validation-list'
            );
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
            <div className="lg:col-span-4 space-y-2">
                {loading ? <Spinner /> : applications.length === 0 ? (
                    <p className="text-sm text-gray-400 py-8 text-center">No flagged applications.</p>
                ) : applications.map(app => (
                    <button key={app.ciReferenceCode} type="button"
                        onClick={() => setSelected(app)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                            selected?.ciReferenceCode === app.ciReferenceCode
                                ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'
                        }`}>
                        <p className="text-sm font-semibold text-gray-900">{app.lastName}, {app.firstName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {app.ciReferenceCode} · {moment(app.submittedAt).format('MMM D, YYYY')}
                        </p>
                    </button>
                ))}
            </div>
            <div className="lg:col-span-8">
                {selected ? (
                    <CIDuplicatePanel application={selected} onValidated={() => { setSelected(null); loadList(); }} />
                ) : (
                    <p className="text-sm text-gray-400 py-20 text-center">Select a flagged application from the list.</p>
                )}
            </div>
        </div>
    );
};

export default CIDuplicateQueue;