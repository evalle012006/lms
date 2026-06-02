// src/components/ci/CIDuplicatePanel.js
// Shows possible duplicate clients for a LAF application during CI investigation.
// Displayed in CIReviewPanel when application.isDuplicateFlagged=true
// OR when application.duplicateCandidateIds has entries.
// Admins/RM/DD see Approve/Decline buttons; others see read-only info.

import React, { useState, useEffect } from 'react';
import { useSelector }                 from 'react-redux';
import { fetchWrapper }                from '@/lib/fetch-wrapper';
import { getApiBaseUrl }               from '@/lib/constants';
import { useSignedUrl }                from 'hooks/useSignedUrl';
import { toast }                       from 'react-toastify';
import { CheckCircle, XCircle, User }  from 'lucide-react';
import moment                          from 'moment';

// ── One candidate card ────────────────────────────────────────────────────
const CandidateCard = ({ client }) => {
    const { signedUrl } = useSignedUrl(client.profile || null);
    return (
        <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            {/* Photo */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border border-gray-300 bg-gray-100">
                {signedUrl ? (
                    <img src={signedUrl} alt="Client"
                        className="w-full h-full object-cover"
                        onError={e => e.target.style.display = 'none'} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-5 h-5" />
                    </div>
                )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                    {client.lastName}, {client.firstName} {client.middleName || ''}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {[
                        client.birthdate && `DOB: ${moment(client.birthdate).format('MMM D, YYYY')}`,
                        client.branchName && `Branch: ${client.branchName}`,
                        client.status && `Status: ${client.status}`,
                        client.governmentIdType && `ID: ${client.governmentIdType} ${client.governmentIdNumber || ''}`,
                    ].filter(Boolean).map((item, i) => (
                        <span key={i} className="text-xs text-gray-500">{item}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Main panel ────────────────────────────────────────────────────────────
const CIDuplicatePanel = ({ application, onValidated }) => {
    const currentUser = useSelector(s => s.user.data);
    const [candidates, setCandidates] = useState([]);
    const [loading,    setLoading]    = useState(false);
    const [note,       setNote]       = useState('');
    const [acting,     setActing]     = useState(false);

    // Only system admin (rep=1) can approve/decline duplicates
    const canValidate =
        currentUser?.role?.rep === 1 ||
        currentUser?.root === true;

    const isDuplicateFlagged = application?.isDuplicateFlagged;
    const isPendingValidation = application?.status === 'pending_validation';
    const candidateIds = application?.duplicateCandidateIds || [];

    // Load candidate client records
    useEffect(() => {
        if (!candidateIds.length) return;
        setLoading(true);
        fetchWrapper.post(getApiBaseUrl() + 'clients/by-ids', { ids: candidateIds })
            .then(res => { if (res.success) setCandidates(res.clients || []); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [candidateIds.join(',')]);

    if (!isDuplicateFlagged && !candidateIds.length) return null;

    const handleAction = async (action) => {
        setActing(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/validate-duplicate',
                { ciReferenceCode: application.ciReferenceCode, action, note }
            );
            if (res.success) {
                toast.success(action === 'approve'
                    ? 'Application approved — branch manager can now promote.'
                    : 'Application declined.');
                onValidated?.();
            } else {
                toast.error(res.message || 'Action failed.');
            }
        } catch { toast.error('Request failed.'); }
        finally { setActing(false); }
    };

    return (
        <div className="border border-orange-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
                <span className="text-base">⚠</span>
                <div>
                    <p className="text-sm font-semibold text-orange-900">
                        Possible Duplicate Client
                    </p>
                    <p className="text-xs text-orange-700">
                        {candidateIds.length} existing client record{candidateIds.length !== 1 ? 's' : ''} matched this applicant's name.
                        {isPendingValidation && ' Admin validation required before this application can be promoted.'}
                        {!isPendingValidation && application?.duplicateValidatedBy && ' Already validated.'}
                    </p>
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Validation result — already decided */}
                {application?.duplicateValidatedBy && (
                    <div className={`p-3 rounded-xl text-xs ${
                        application.status === 'ci_approved'
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                        <p className="font-semibold">
                            {application.status === 'ci_approved' ? '✓ Approved' : '✗ Declined'} by {application.duplicateValidatedBy}
                        </p>
                        <p className="mt-0.5">
                            {moment(application.duplicateValidatedAt).format('MMM D, YYYY h:mm A')}
                        </p>
                        {application.duplicateValidationNote && (
                            <p className="mt-1 italic">{application.duplicateValidationNote}</p>
                        )}
                    </div>
                )}

                {/* Candidate cards */}
                {loading ? (
                    <div className="text-xs text-gray-400 py-2">Loading matching records...</div>
                ) : candidates.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Matching Records
                        </p>
                        {candidates.map(cl => <CandidateCard key={cl._id} client={cl} />)}
                    </div>
                ) : candidateIds.length > 0 ? (
                    <p className="text-xs text-gray-400">
                        {candidateIds.length} candidate ID(s) — records not loaded.
                    </p>
                ) : null}

                {/* Action panel — admin/RM/DD only, only when pending_validation */}
                {isPendingValidation && canValidate && (
                    <div className="space-y-2 pt-2 border-t border-orange-100">
                        <p className="text-xs font-semibold text-gray-600">Your Decision</p>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Validation note (optional)..."
                            rows={2}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                        <div className="flex gap-2">
                            <button type="button"
                                onClick={() => handleAction('approve')}
                                disabled={acting}
                                className="flex-1 py-2.5 bg-green-600 text-white text-xs font-semibold
                                    rounded-xl hover:bg-green-700 disabled:opacity-50
                                    flex items-center justify-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {acting ? 'Processing...' : 'Approve — Different Person'}
                            </button>
                            <button type="button"
                                onClick={() => handleAction('decline')}
                                disabled={acting}
                                className="flex-1 py-2.5 bg-red-600 text-white text-xs font-semibold
                                    rounded-xl hover:bg-red-700 disabled:opacity-50
                                    flex items-center justify-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5" />
                                {acting ? 'Processing...' : 'Decline — Is Duplicate'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Read-only for non-validators */}
                {isPendingValidation && !canValidate && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                        Waiting for a system administrator to validate this application.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CIDuplicatePanel;