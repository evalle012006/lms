// src/pages/settings/mobile-enrollment/index.js
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import moment from 'moment';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import { ImageOff, X, User, Check, XCircle } from 'lucide-react';

const PAGE_SIZE = 25;

const METHOD_FILTERS = [
    { value: '', label: 'All methods' },
    { value: 'auto_contact_match', label: 'Auto (contact match)' },
    { value: 'staff_activated', label: 'Staff activated' },
    { value: 'self_registered_id_verified', label: 'Self-registered' },
];

const OUTCOME_FILTERS = [
    { value: '', label: 'All outcomes' },
    { value: 'success', label: 'Success' },
    { value: 'pending_review', label: 'Pending review' },
    { value: 'no_client_found', label: 'No client found' },
    { value: 'disambiguation_required', label: 'Disambiguation required' },
    { value: 'staff_required', label: 'Staff required' },
    { value: 'otp_failed', label: 'OTP failed' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
];

const OUTCOME_STYLES = {
    success:                   'bg-green-50 text-green-700 border-green-200',
    approved:                  'bg-green-50 text-green-700 border-green-200',
    pending_review:            'bg-amber-50 text-amber-700 border-amber-200',
    no_client_found:           'bg-red-50 text-red-700 border-red-200',
    disambiguation_required:   'bg-amber-50 text-amber-700 border-amber-200',
    staff_required:            'bg-red-50 text-red-700 border-red-200',
    otp_failed:                'bg-red-50 text-red-700 border-red-200',
    rejected:                  'bg-red-50 text-red-700 border-red-200',
};

const METHOD_LABELS = {
    auto_contact_match: 'Auto',
    staff_activated: 'Staff',
    self_registered_id_verified: 'Self-reg',
};

const MobileEnrollmentPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const router = useRouter();

    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [method, setMethod] = useState('');
    const [outcome, setOutcome] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [zoomAttempt, setZoomAttempt] = useState(null);
    const [rejectingAttempt, setRejectingAttempt] = useState(null);
    const [actionLoading, setActionLoading] = useState(null); // attempt id currently being approved/rejected

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
            if (method) params.set('method', method);
            if (outcome) params.set('outcome', outcome);
            if (search) params.set('search', search);
            const res = await fetchWrapper.get(getApiBaseUrl() + 'clients/mobile-enrollment/list?' + params.toString());
            if (!res.success) return;
            setAttempts(res.attempts);
            setTotal(res.total);
        } finally {
            setLoading(false);
        }
    }, [page, method, outcome, search]);

    useEffect(() => { load(); }, [load]);

    const photoKeys = attempts
        .filter(a => a.request)
        .flatMap(a => [a.request.government_id_photo_key, a.request.selfie_photo_key])
        .filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    async function handleApprove(attempt) {
        setActionLoading(attempt._id);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/mobile-enrollment/approve', {
                requestId: attempt.enrollment_request_id,
            });
            if (res.success) load();
        } finally {
            setActionLoading(null);
        }
    }

    async function handleReject(attempt, reason) {
        setActionLoading(attempt._id);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/mobile-enrollment/reject', {
                requestId: attempt.enrollment_request_id,
                reason,
            });
            if (res.success) { setRejectingAttempt(null); load(); }
        } finally {
            setActionLoading(null);
        }
    }

    if (!currentUser?.root) return null;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <Layout>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mobile Enrollment Attempts</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Every registration/activation outcome — successes, failures, and items awaiting review
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-3 flex-wrap">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search by name or contact number..."
                        className="flex-1 min-w-[200px] border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={method}
                        onChange={(e) => { setPage(1); setMethod(e.target.value); }}
                        className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white"
                    >
                        {METHOD_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select
                        value={outcome}
                        onChange={(e) => { setPage(1); setOutcome(e.target.value); }}
                        className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white"
                    >
                        {OUTCOME_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
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
                            const idUrl     = a.request?.government_id_photo_key ? urlMap[a.request.government_id_photo_key] : null;
                            const selfieUrl = a.request?.selfie_photo_key ? urlMap[a.request.selfie_photo_key] : null;
                            const canReview = a.outcome === 'pending_review' && a.enrollment_request_id;

                            return (
                                <div key={a._id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                                    {a.request ? (
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <PhotoThumb url={idUrl} label="ID" onClick={() => setZoomAttempt(a)} />
                                            <span className="text-gray-300 text-xs">vs</span>
                                            <PhotoThumb url={selfieUrl} label="Selfie" onClick={() => setZoomAttempt(a)} />
                                        </div>
                                    ) : (
                                        <div className="w-[124px] flex-shrink-0" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {a.clientName || <span className="font-mono text-xs text-gray-400">{a.contact_number}</span>}
                                        </p>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5">{a.contact_number}</p>
                                        {a.detail && <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>}
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {moment.utc(a.created_at).local().format('MMM D, YYYY h:mm A')}
                                            {a.reviewedByName && ` · reviewed by ${a.reviewedByName}`}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                            {METHOD_LABELS[a.method] ?? a.method}
                                        </span>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${OUTCOME_STYLES[a.outcome] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                            {a.outcome.replace(/_/g, ' ')}
                                        </span>

                                        {canReview && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleApprove(a)}
                                                    disabled={actionLoading === a._id}
                                                    className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                                                    title="Approve"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setRejectingAttempt(a)}
                                                    disabled={actionLoading === a._id}
                                                    className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                                                    title="Reject"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
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

            {zoomAttempt && (
                <ComparisonZoomOverlay
                    idUrl={zoomAttempt.request?.government_id_photo_key ? urlMap[zoomAttempt.request.government_id_photo_key] : null}
                    selfieUrl={zoomAttempt.request?.selfie_photo_key ? urlMap[zoomAttempt.request.selfie_photo_key] : null}
                    clientName={zoomAttempt.clientName || zoomAttempt.contact_number}
                    onClose={() => setZoomAttempt(null)}
                />
            )}

            {rejectingAttempt && (
                <RejectReasonModal
                    onCancel={() => setRejectingAttempt(null)}
                    onConfirm={(reason) => handleReject(rejectingAttempt, reason)}
                    loading={actionLoading === rejectingAttempt._id}
                />
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

// Same layout/interaction pattern as face-verify-attempts's comparison
// overlay, relabeled for ID-vs-selfie instead of enrolled-vs-captured.
const ComparisonZoomOverlay = ({ idUrl, selfieUrl, clientName, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col" onClick={onClose}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm font-semibold">ID Verification — {clientName}</p>
            <button type="button" onClick={onClose}
                className="p-2 bg-white bg-opacity-10 rounded-full text-white hover:bg-opacity-20 transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>
        <div className="flex flex-1 items-center justify-center gap-6 px-6 pb-6 min-h-0" onClick={e => e.stopPropagation()}>
            {[["Government ID", idUrl], ["Selfie", selfieUrl]].map(([label, url]) => (
                <div key={label} className="flex flex-col items-center gap-3 flex-1 min-w-0 max-w-sm h-full">
                    <span className="text-white text-xs font-semibold uppercase tracking-widest bg-white bg-opacity-10 px-3 py-1 rounded-full">{label}</span>
                    <div className="flex-1 w-full flex items-center justify-center min-h-0">
                        {url ? (
                            <img src={url} alt={label} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                        ) : (
                            <div className="w-48 h-48 rounded-2xl bg-white bg-opacity-10 flex items-center justify-center">
                                <User className="w-16 h-16 text-white opacity-30" />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
        <p className="text-center text-white text-xs opacity-30 pb-4 flex-shrink-0">Tap anywhere outside to close</p>
    </div>
);

const RejectReasonModal = ({ onCancel, onConfirm, loading }) => {
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center px-4" onClick={onCancel}>
            <div className="bg-white rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold text-gray-900 mb-2">Reject this request</h3>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (shown in the log, not to the client)"
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 mb-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button
                        onClick={() => reason.trim() && onConfirm(reason.trim())}
                        disabled={!reason.trim() || loading}
                        className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        Reject
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileEnrollmentPage;