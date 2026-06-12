// src/components/ci/CIDuplicatePanel.js
// Shown in CIReviewPanel when application.isDuplicateFlagged=true
//
// BM view (rep=3/4):
//   - Read-only list of duplicate candidates with photos for visual comparison
//   - Can add a remark about the client
//   - Cannot approve/decline/merge
//
// Admin/Division/Region view (rep=1/2):
//   Three decisions:
//   1. "Different Person" — approve the LAF as a new client
//   2. "Same Person — Merge" — select master client, trigger merge API
//   3. "Decline Application" — decline the LAF

import React, { useState, useEffect } from 'react';
import { useSelector }                 from 'react-redux';
import { fetchWrapper }                from '@/lib/fetch-wrapper';
import { getApiBaseUrl }               from '@/lib/constants';
import { useSignedUrl, useBulkSignedUrls } from 'hooks/useSignedUrl';
import { toast }                       from 'react-toastify';
import { CheckCircle, XCircle, User, GitMerge } from 'lucide-react';
import moment                          from 'moment';

// ── Photo comparison component ────────────────────────────────────────────
const ClientPhoto = ({ photoKey, name, label, size = 'md' }) => {
    const { signedUrl } = useSignedUrl(photoKey || null);
    const dim = size === 'lg' ? 'w-24 h-24' : 'w-14 h-14';
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={`${dim} rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100 flex-shrink-0`}>
                {signedUrl ? (
                    <img src={signedUrl} alt={name}
                        className="w-full h-full object-cover"
                        onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <User className="w-6 h-6" />
                    </div>
                )}
            </div>
            {label && <p className="text-[10px] text-gray-500 text-center max-w-[80px] leading-tight">{label}</p>}
        </div>
    );
};

// ── One candidate card ────────────────────────────────────────────────────
const CandidateCard = ({ client, applicant, selected, onSelect, canSelect }) => (
    <div className={`p-3 rounded-xl border-2 transition-colors ${
        selected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-gray-50'
    }`}>
        {/* Side-by-side photo comparison */}
        <div className="flex items-center gap-3 mb-3">
            <ClientPhoto photoKey={applicant?.lafPhotoKey} name="Applicant" label="Applicant (LAF)" size="lg" />
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-6 h-0.5 bg-gray-300" />
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">vs</p>
                <div className="w-6 h-0.5 bg-gray-300" />
            </div>
            <ClientPhoto photoKey={client.profile} name={client.firstName} label="Existing Client" size="lg" />
        </div>

        {/* Client details */}
        <div className="space-y-0.5">
            <p className="text-sm font-semibold text-gray-900">
                {client.lastName}, {client.firstName} {client.middleName || ''}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {client.birthdate && (
                    <span className="text-xs text-gray-500">
                        DOB: {moment(client.birthdate).format('MMM D, YYYY')}
                    </span>
                )}
                {client.branchName && (
                    <span className="text-xs text-gray-500">Branch: {client.branchName}</span>
                )}
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    client.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : client.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                }`}>
                    {client.status}
                </span>
            </div>
            {client.governmentIdType && (
                <p className="text-xs text-gray-400">
                    ID: {client.governmentIdType} {client.governmentIdNumber || ''}
                </p>
            )}
            {client.address && (
                <p className="text-xs text-gray-400 truncate">{client.address}</p>
            )}
        </div>

        {/* Select as master button — admin only */}
        {canSelect && (
            <button type="button" onClick={() => onSelect(client._id)}
                className={`mt-3 w-full py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}>
                {selected ? '✓ Selected as Master' : 'Select as Master Record'}
            </button>
        )}
    </div>
);

// ── Main component ────────────────────────────────────────────────────────
const CIDuplicatePanel = ({ application, onValidated }) => {
    const currentUser = useSelector(s => s.user.data);
    const [candidates,     setCandidates]     = useState([]);
    const [loading,        setLoading]        = useState(false);
    const [decision,       setDecision]       = useState(null); // 'different' | 'merge' | 'decline'
    const [masterId,       setMasterId]       = useState(null);
    const [bmRemark,       setBmRemark]       = useState(application?.duplicateValidationNote || '');
    const [savingRemark,   setSavingRemark]   = useState(false);
    const [acting,         setActing]         = useState(false);
    const [note,           setNote]           = useState('');

    const rep = currentUser?.role?.rep;
    // BM (rep=3/4) — read-only + remark only
    const isBM        = rep === 3 || rep === 4;
    // Admin (rep=1), Division (rep=2) — full decision
    const canDecide   = rep === 1 || rep === 2 || currentUser?.root === true;

    const isDuplicateFlagged  = application?.isDuplicateFlagged;
    const isPendingValidation = application?.status === 'pending_validation';
    const candidateIds        = application?.duplicateCandidateIds || [];
    const alreadyValidated    = !!application?.duplicateValidatedBy;

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

    // BM save remark
    const handleSaveRemark = async () => {
        setSavingRemark(true);
        try {
            await fetchWrapper.post(getApiBaseUrl() + 'laf/update-duplicate-note', {
                ciReferenceCode: application.ciReferenceCode,
                note: bmRemark,
            });
            toast.success('Remark saved.');
        } catch {
            toast.error('Failed to save remark.');
        } finally {
            setSavingRemark(false);
        }
    };

    // Admin decision
    const handleDecision = async () => {
        if (!decision) { toast.error('Please select a decision.'); return; }
        if (decision === 'merge' && !masterId) {
            toast.error('Please select which client record to keep as master.');
            return;
        }

        setActing(true);
        try {
            if (decision === 'merge') {
                // Merge: re-link all records from duplicate → master
                const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/merge', {
                    masterId,
                    duplicateId: candidateIds.find(id => id !== masterId) || candidateIds[0],
                    ciReferenceCode: application.ciReferenceCode,
                });
                if (!res.success) throw new Error(res.message || 'Merge failed.');
                toast.success(`Merge complete. ${res.relinked?.loans || 0} loan(s) re-linked to master client.`);
                onValidated?.();
            } else {
                // Different person or Decline
                const res = await fetchWrapper.post(getApiBaseUrl() + 'laf/validate-duplicate', {
                    ciReferenceCode: application.ciReferenceCode,
                    action: decision === 'different' ? 'approve' : 'decline',
                    note,
                });
                if (!res.success) throw new Error(res.message || 'Action failed.');
                toast.success(
                    decision === 'different'
                        ? 'Confirmed as different person — branch manager can now proceed with CI.'
                        : 'Application declined.'
                );
                onValidated?.();
            }
        } catch (err) {
            toast.error(err.message || 'Request failed.');
        } finally {
            setActing(false);
        }
    };

    return (
        <div className="border border-orange-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
                <div className="flex items-center gap-2">
                    <span className="text-base">⚠</span>
                    <div>
                        <p className="text-sm font-semibold text-orange-900">
                            Possible Duplicate Client
                        </p>
                        <p className="text-xs text-orange-700">
                            {candidateIds.length} existing client record{candidateIds.length !== 1 ? 's' : ''} matched this applicant's name.
                            {isPendingValidation && !alreadyValidated && ' Awaiting admin validation.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Already validated banner */}
                {alreadyValidated && (
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
                    <p className="text-xs text-gray-400 py-2">Loading matching records...</p>
                ) : candidates.length > 0 ? (
                    <div className="space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Matching Records — Photo Comparison
                        </p>
                        {candidates.map(cl => (
                            <CandidateCard
                                key={cl._id}
                                client={cl}
                                applicant={application}
                                selected={masterId === cl._id}
                                onSelect={id => {
                                    setMasterId(id);
                                    setDecision('merge');
                                }}
                                canSelect={canDecide && isPendingValidation && !alreadyValidated}
                            />
                        ))}
                    </div>
                ) : candidateIds.length > 0 ? (
                    <p className="text-xs text-gray-400">
                        {candidateIds.length} candidate ID(s) — records not loaded.
                    </p>
                ) : null}

                {/* BM remark section */}
                <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">
                        {isBM ? 'Your Remark (optional)' : 'Branch Manager Remark'}
                    </p>
                    {isBM ? (
                        <div className="space-y-2">
                            <textarea
                                value={bmRemark}
                                onChange={e => setBmRemark(e.target.value)}
                                placeholder="Add context about this client for admin review (e.g. client confirmed they are a new applicant, showed valid ID)..."
                                rows={3}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg
                                    focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            />
                            {!alreadyValidated && (
                                <button type="button" onClick={handleSaveRemark}
                                    disabled={savingRemark}
                                    className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium
                                        rounded-lg hover:bg-gray-700 disabled:opacity-50">
                                    {savingRemark ? 'Saving...' : 'Save Remark'}
                                </button>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-600 italic p-2 bg-gray-50 rounded-lg">
                            {application?.duplicateValidationNote || 'No remark from branch manager.'}
                        </p>
                    )}
                </div>

                {/* Admin decision panel */}
                {canDecide && isPendingValidation && !alreadyValidated && (
                    <div className="space-y-3 pt-3 border-t border-orange-100">
                        <p className="text-xs font-semibold text-gray-700">Your Decision</p>

                        {/* Decision buttons */}
                        <div className="grid grid-cols-1 gap-2">
                            {/* Different person */}
                            <button type="button"
                                onClick={() => { setDecision('different'); setMasterId(null); }}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left
                                    transition-colors ${
                                    decision === 'different'
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-200 hover:border-green-300'
                                }`}>
                                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                                    decision === 'different' ? 'text-green-600' : 'text-gray-400'
                                }`} />
                                <div>
                                    <p className={`text-sm font-semibold ${
                                        decision === 'different' ? 'text-green-800' : 'text-gray-700'
                                    }`}>Different Person</p>
                                    <p className="text-xs text-gray-500">
                                        This is a new client — the name match is coincidental. Proceed with CI.
                                    </p>
                                </div>
                            </button>

                            {/* Same person — merge */}
                            <button type="button"
                                onClick={() => setDecision('merge')}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left
                                    transition-colors ${
                                    decision === 'merge'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                }`}>
                                <GitMerge className={`w-5 h-5 flex-shrink-0 ${
                                    decision === 'merge' ? 'text-blue-600' : 'text-gray-400'
                                }`} />
                                <div>
                                    <p className={`text-sm font-semibold ${
                                        decision === 'merge' ? 'text-blue-800' : 'text-gray-700'
                                    }`}>Same Person — Merge Records</p>
                                    <p className="text-xs text-gray-500">
                                        This applicant is an existing client. Select the master record above.
                                        All loans and history will be consolidated.
                                    </p>
                                </div>
                            </button>

                            {/* Decline */}
                            <button type="button"
                                onClick={() => { setDecision('decline'); setMasterId(null); }}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left
                                    transition-colors ${
                                    decision === 'decline'
                                        ? 'border-red-500 bg-red-50'
                                        : 'border-gray-200 hover:border-red-300'
                                }`}>
                                <XCircle className={`w-5 h-5 flex-shrink-0 ${
                                    decision === 'decline' ? 'text-red-600' : 'text-gray-400'
                                }`} />
                                <div>
                                    <p className={`text-sm font-semibold ${
                                        decision === 'decline' ? 'text-red-800' : 'text-gray-700'
                                    }`}>Decline Application</p>
                                    <p className="text-xs text-gray-500">
                                        Reject this loan application entirely.
                                    </p>
                                </div>
                            </button>
                        </div>

                        {/* Merge master selection reminder */}
                        {decision === 'merge' && !masterId && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                ↑ Please select which client record above to keep as the master record.
                            </div>
                        )}

                        {/* Merge summary */}
                        {decision === 'merge' && masterId && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                                <p className="font-semibold mb-1">Merge Summary</p>
                                <p>The selected existing client will be the master record.</p>
                                <p className="mt-0.5">All loans, collections, and MCBU records from the duplicate will be re-linked to the master.</p>
                                <p className="mt-0.5 text-blue-600">The duplicate client will be marked as merged and excluded from future operations.</p>
                            </div>
                        )}

                        {/* Admin note */}
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Decision note (optional — explain your reasoning)..."
                            rows={2}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />

                        {/* Confirm button */}
                        <button type="button" onClick={handleDecision}
                            disabled={acting || !decision || (decision === 'merge' && !masterId)}
                            className={`w-full py-2.5 text-white text-sm font-semibold rounded-xl
                                disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${
                                decision === 'merge'   ? 'bg-blue-600 hover:bg-blue-700' :
                                decision === 'decline' ? 'bg-red-600 hover:bg-red-700'   :
                                                         'bg-green-600 hover:bg-green-700'
                            }`}>
                            {acting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10"
                                            stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor"
                                            d="M4 12a8 8 0 018-8v8H4z"/>
                                    </svg>
                                    Processing...
                                </>
                            ) : decision === 'merge'   ? 'Confirm Merge'
                              : decision === 'decline' ? 'Decline Application'
                              : decision === 'different' ? 'Confirm — Different Person'
                              : 'Select a Decision'}
                        </button>
                    </div>
                )}

                {/* Non-admin pending message */}
                {!canDecide && isPendingValidation && !alreadyValidated && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-800 mb-1">
                            ⏳ Awaiting Admin Validation
                        </p>
                        <p className="text-xs text-amber-700">
                            This application requires a Division Manager or System Administrator to review
                            the duplicate records and decide whether to approve, merge, or decline.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CIDuplicatePanel;