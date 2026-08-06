// src/pages/clients/pending-duplicates.js
// Admin/Division/Region page — lists all LAF applications flagged as pending_validation
// Accessible: rep=1 (system admin), rep=2 (division/region managers)
// Each row expands to show the full CIDuplicatePanel for review

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter }   from 'next/router';
import moment          from 'moment';
import Layout          from '@/components/Layout';
import Spinner         from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import CIDuplicatePanel from '@/components/ci/CIDuplicatePanel';
import { useSignedUrl } from 'hooks/useSignedUrl';

// ── One application row ───────────────────────────────────────────────────
const ApplicationRow = ({ application, onResolved }) => {
    const [expanded, setExpanded] = useState(false);
    const { signedUrl } = useSignedUrl(application.lafPhotoKey || null);

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Summary row */}
            <button type="button" onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50
                    transition-colors text-left">
                {/* Photo */}
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200
                    bg-gray-100 flex-shrink-0">
                    {signedUrl ? (
                        <img src={signedUrl} alt="Applicant"
                            className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center
                            text-xs font-bold text-gray-400">
                            {application.firstName?.[0]}{application.lastName?.[0]}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                        {application.lastName}, {application.firstName} {application.middleName || ''}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">
                            {application.ciReferenceCode}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">
                            {application.branchName || application.branchCode}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">
                            {moment(application.submittedAt).format('MMM D, YYYY')}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100
                            text-orange-700 rounded-full">
                            {application.duplicateCandidateIds?.length || 0} match{application.duplicateCandidateIds?.length !== 1 ? 'es' : ''}
                        </span>
                        {application.duplicateValidationNote && (
                            <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600
                                rounded-full">
                                Has BM remark
                            </span>
                        )}
                    </div>
                </div>

                {/* Expand chevron */}
                <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                    expanded ? 'rotate-180' : ''
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded duplicate panel */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                    <CIDuplicatePanel
                        application={application}
                        onValidated={() => {
                            setExpanded(false);
                            onResolved(application.ciReferenceCode);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────
const PendingDuplicatesPage = () => {
    const router      = useRouter();
    const currentUser = useSelector(s => s.user.data);
    const rep         = currentUser?.role?.rep;

    const [applications, setApplications] = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [refreshKey,   setRefreshKey]   = useState(0);

    // Only rep=1 and rep=2 can access
    useEffect(() => {
        if (!currentUser) return;
        if (rep !== 1 && rep !== 2 && !currentUser.root) {
            router.replace('/');
        }
    }, [currentUser, rep, router]);

    useEffect(() => {
        if (rep !== 1 && rep !== 2 && !currentUser?.root) return;
        setLoading(true);
        fetchWrapper.get(
            getApiBaseUrl() + 'laf/pending-duplicates'
        )
        .then(res => {
            if (res.success) setApplications(res.applications || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [refreshKey, rep, currentUser]);

    const handleResolved = (ciReferenceCode) => {
        setApplications(prev => prev.filter(a => a.ciReferenceCode !== ciReferenceCode));
    };

    if (rep !== 1 && rep !== 2 && !currentUser?.root) return null;

    return (
        <Layout>
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Pending Duplicate Reviews</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Loan applications flagged by the system as possible duplicate clients.
                            Review photo comparison and decide on each case.
                        </p>
                    </div>
                    <button type="button" onClick={() => setRefreshKey(k => k + 1)}
                        className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200
                            rounded-lg hover:bg-gray-50 transition-colors">
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Spinner />
                    </div>
                ) : applications.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium">No pending duplicate reviews</p>
                        <p className="text-xs mt-1">All flagged applications have been resolved.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500">
                            {applications.length} application{applications.length !== 1 ? 's' : ''} pending review
                        </p>
                        {applications.map(app => (
                            <ApplicationRow
                                key={app.ciReferenceCode}
                                application={app}
                                onResolved={handleResolved}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default PendingDuplicatesPage;