// src/components/ci/CIDuplicatePanel.js
// Two operations, clearly separated:
//   1. Link LAF to existing client (applicant = existing client, reloan)
//   2. Merge two existing client records (admin-only, irreversible, separate confirm)
// Simple language, clear warnings, confirmation dialog before destructive action.

import React, { useState, useEffect } from 'react';
import { useSelector }    from 'react-redux';
import { fetchWrapper }   from '@/lib/fetch-wrapper';
import { getApiBaseUrl }  from '@/lib/constants';
import { useSignedUrl }   from 'hooks/useSignedUrl';
import { toast }          from 'react-toastify';
import { CheckCircle, XCircle, User, X, ZoomIn, GitMerge, AlertTriangle } from 'lucide-react';
import moment             from 'moment';

// ── Confirmation dialog ───────────────────────────────────────────────────
const ConfirmDialog = ({ title, message, warning, onConfirm, onCancel, confirmLabel, confirmCls }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9998] flex items-center
        justify-center p-4" onClick={onCancel}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 mb-3">{message}</p>
            {warning && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200
                    rounded-xl mb-4">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{warning}</p>
                </div>
            )}
            <div className="flex gap-3">
                <button type="button" onClick={onCancel}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm
                        font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button type="button" onClick={onConfirm}
                    className={`flex-1 py-2.5 text-white text-sm font-semibold rounded-xl
                        transition-colors ${confirmCls}`}>
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

// ── Full-screen side-by-side zoom overlay ─────────────────────────────────
const ComparisonZoomOverlay = ({ applicantUrl, clientUrl, clientName, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[9999] flex flex-col"
        onClick={onClose}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm font-semibold">
                Photo Comparison — {clientName}
            </p>
            <button type="button" onClick={onClose}
                className="p-2 bg-white bg-opacity-10 rounded-full text-white
                    hover:bg-opacity-20 transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>
        <div className="flex flex-1 items-center justify-center gap-6 px-6 pb-6 min-h-0"
            onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 flex-1 min-w-0 max-w-sm h-full">
                <span className="text-white text-xs font-semibold uppercase tracking-widest
                    bg-white bg-opacity-10 px-3 py-1 rounded-full">Applicant (LAF)</span>
                <div className="flex-1 w-full flex items-center justify-center min-h-0">
                    {applicantUrl ? (
                        <img src={applicantUrl} alt="Applicant"
                            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                    ) : (
                        <div className="w-48 h-48 rounded-2xl bg-white bg-opacity-10
                            flex items-center justify-center">
                            <User className="w-16 h-16 text-white opacity-30" />
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-px h-20 bg-white bg-opacity-20" />
                <span className="text-white text-xs font-bold opacity-50">VS</span>
                <div className="w-px h-20 bg-white bg-opacity-20" />
            </div>
            <div className="flex flex-col items-center gap-3 flex-1 min-w-0 max-w-sm h-full">
                <span className="text-white text-xs font-semibold uppercase tracking-widest
                    bg-white bg-opacity-10 px-3 py-1 rounded-full">Existing Client</span>
                <div className="flex-1 w-full flex items-center justify-center min-h-0">
                    {clientUrl ? (
                        <img src={clientUrl} alt={clientName}
                            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                    ) : (
                        <div className="w-48 h-48 rounded-2xl bg-white bg-opacity-10
                            flex items-center justify-center">
                            <User className="w-16 h-16 text-white opacity-30" />
                        </div>
                    )}
                </div>
            </div>
        </div>
        <p className="text-center text-white text-xs opacity-30 pb-4 flex-shrink-0">
            Tap anywhere outside to close
        </p>
    </div>
);

// ── Photo tile ────────────────────────────────────────────────────────────
const PhotoTile = ({ url, label, onZoom }) => (
    <div className="flex flex-col items-center gap-2 flex-1">
        <button type="button" onClick={onZoom} disabled={!url}
            className="relative group w-full aspect-square max-w-[110px] rounded-2xl
                overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center
                justify-center disabled:cursor-default">
            {url ? (
                <>
                    <img src={url} alt={label}
                        className="w-full h-full object-cover"
                        onError={e => { e.target.style.display = 'none'; }} />
                    <div className="absolute inset-0 bg-black bg-opacity-0
                        group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white opacity-0
                            group-hover:opacity-100 transition-opacity" />
                    </div>
                </>
            ) : (
                <User className="w-9 h-9 text-gray-300" />
            )}
        </button>
        <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">
            {label}
        </span>
    </div>
);

// ── One candidate card ────────────────────────────────────────────────────
const CandidateCard = ({
    client,
    applicantLafPhotoUrl,
    selectedForLink,      // this client is selected for "Link LAF" action
    selectedForMerge,     // this client is selected as master for merge
    mergeTargetId,        // the OTHER client being merged into this one
    onSelectLink,
    onSelectMergeInto,    // select this as master (merge target comes into this)
    canDecide,
    allCandidates,
}) => {
    const { signedUrl: clientPhotoUrl } = useSignedUrl(client.profile || null);
    const [zoomOpen, setZoomOpen]       = useState(false);
    const clientName = `${client.lastName}, ${client.firstName}${client.middleName ? ' ' + client.middleName : ''}`.trim();

    const isActive    = client.status === 'active';
    const isLinkSelected   = selectedForLink;
    const isMergeMaster    = selectedForMerge;
    const isMergeTarget    = mergeTargetId === client._id;

    return (
        <>
            {zoomOpen && (
                <ComparisonZoomOverlay
                    applicantUrl={applicantLafPhotoUrl}
                    clientUrl={clientPhotoUrl}
                    clientName={clientName}
                    onClose={() => setZoomOpen(false)}
                />
            )}

            <div className={`p-4 rounded-2xl border-2 transition-colors ${
                isMergeMaster  ? 'border-purple-500 bg-purple-50' :
                isMergeTarget  ? 'border-orange-400 bg-orange-50' :
                isLinkSelected ? 'border-blue-500 bg-blue-50'     :
                                 'border-gray-200 bg-gray-50'
            }`}>
                {/* Status tag at top right */}
                <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        client.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : client.status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                    }`}>
                        {client.status}
                    </span>
                    {isMergeMaster && (
                        <span className="text-xs font-semibold px-2 py-0.5 bg-purple-100
                            text-purple-700 rounded-full">Master Record</span>
                    )}
                    {isMergeTarget && (
                        <span className="text-xs font-semibold px-2 py-0.5 bg-orange-100
                            text-orange-700 rounded-full">Will be archived</span>
                    )}
                </div>

                {/* Side-by-side photos */}
                <div className="flex items-center gap-3 mb-3">
                    <PhotoTile url={applicantLafPhotoUrl} label="Applicant (LAF)"
                        onZoom={() => setZoomOpen(true)} />
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className="w-5 h-px bg-gray-300" />
                        <button type="button" onClick={() => setZoomOpen(true)}
                            className="flex flex-col items-center gap-0.5 group">
                            <span className="text-[9px] font-bold text-gray-400
                                group-hover:text-blue-500 uppercase tracking-wide">vs</span>
                            <ZoomIn className="w-3 h-3 text-gray-300
                                group-hover:text-blue-500 transition-colors" />
                        </button>
                        <div className="w-5 h-px bg-gray-300" />
                    </div>
                    <PhotoTile url={clientPhotoUrl} label="Existing Client"
                        onZoom={() => setZoomOpen(true)} />
                </div>

                {/* Client info */}
                <div className="mb-3 space-y-0.5">
                    <p className="text-sm font-bold text-gray-900">{clientName}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                        {client.birthdate && (
                            <span>DOB: {moment(client.birthdate).format('MMM D, YYYY')}</span>
                        )}
                        {client.branchName && <span>Branch: {client.branchName}</span>}
                    </div>
                    {client.governmentIdType && (
                        <p className="text-xs text-gray-400">
                            {client.governmentIdType}: {client.governmentIdNumber || '—'}
                        </p>
                    )}
                </div>

                {/* Zoom button */}
                <button type="button" onClick={() => setZoomOpen(true)}
                    className="w-full text-xs text-blue-500 hover:text-blue-700 flex items-center
                        justify-center gap-1 py-1.5 rounded-lg hover:bg-blue-50 transition-colors mb-3">
                    <ZoomIn className="w-3.5 h-3.5" />
                    Compare photos side by side (full screen)
                </button>

                {/* Action buttons — only shown for admins */}
                {canDecide && (
                    <div className="space-y-2">
                        {/* Button 1: This IS the applicant (link LAF) */}
                        <button type="button" onClick={() => onSelectLink(client._id)}
                            className={`w-full py-2 text-xs font-semibold rounded-xl border-2
                                transition-colors ${
                                isLinkSelected
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}>
                            {isLinkSelected
                                ? '✓ Selected — this is the applicant'
                                : 'The applicant is this person (applying again)'}
                        </button>

                        {/* Button 2: Merge the other client INTO this one (only shows if 2 candidates) */}
                        {allCandidates.length === 2 && (
                            <button type="button" onClick={() => onSelectMergeInto(client._id)}
                                className={`w-full py-2 text-xs font-semibold rounded-xl border-2
                                    transition-colors ${
                                    isMergeMaster
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-purple-400 hover:text-purple-600'
                                }`}>
                                {isMergeMaster
                                    ? '✓ Keep this record (archive the other one)'
                                    : 'Keep this record — merge the other one into it'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

// ── Main component ────────────────────────────────────────────────────────
const CIDuplicatePanel = ({ application, onValidated }) => {
    const currentUser = useSelector(s => s.user.data);
    const [candidates,   setCandidates]   = useState([]);
    const [loading,      setLoading]      = useState(false);
    const [acting,       setActing]       = useState(false);

    // Link LAF state
    const [linkClientId,  setLinkClientId]  = useState(null);

    // Merge state (only when 2 candidates)
    const [mergeMasterId, setMergeMasterId] = useState(null); // master = survives

    // Decision type: 'different' | 'link' | 'merge_clients' | 'decline'
    const [decision, setDecision] = useState(null);

    // Confirmation dialog
    const [confirmOpen, setConfirmOpen] = useState(false);

    // BM remark
    const [bmRemark,     setBmRemark]     = useState(application?.duplicateValidationNote || '');
    const [savingRemark, setSavingRemark] = useState(false);
    const [note,         setNote]         = useState('');

    const isAdmin      = currentUser?.role?.rep === 1 || currentUser?.root === true;
    const isSupervisor = currentUser?.role?.rep === 2 &&
        (currentUser?.role?.shortCode === 'deputy_director' || currentUser?.role?.shortCode === 'regional_manager'
            || currentUser?.role?.shortCode === 'area_admin'
        );
    const isBM          = currentUser?.role?.shortCode === 'branch_manager';
    const canValidate    = isAdmin || isSupervisor || isBM;

    const isDuplicateFlagged  = application?.isDuplicateFlagged;
    const isPendingValidation = application?.status === 'pending_validation';
    const candidateIds        = application?.duplicateCandidateIds || [];
    const alreadyValidated    = !!application?.duplicateValidatedBy;
    const applicantLafPhotoUrl = application?.lafPhotoUrl || null;

    useEffect(() => {
        if (!candidateIds.length) return;
        setLoading(true);
        fetchWrapper.post(getApiBaseUrl() + 'clients/by-ids', { ids: candidateIds })
            .then(res => { if (res.success) setCandidates(res.clients || []); })
            .catch(() => {})
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidateIds.join(',')]);

    if (!isDuplicateFlagged && !candidateIds.length) return null;

    // Derived
    const mergeTargetId   = mergeMasterId
        ? candidates.find(c => c._id !== mergeMasterId)?._id
        : null;
    const mergeMaster     = candidates.find(c => c._id === mergeMasterId);
    const mergeTarget     = candidates.find(c => c._id === mergeTargetId);
    const linkClient      = candidates.find(c => c._id === linkClientId);

    // ── BM save remark ────────────────────────────────────────────────────
    const handleSaveRemark = async () => {
        if (!bmRemark.trim()) return;
        setSavingRemark(true);
        try {
            await fetchWrapper.post(getApiBaseUrl() + 'laf/update-duplicate-note', {
                ciReferenceCode: application.ciReferenceCode,
                note: bmRemark.trim(),
            });
            toast.success('Remark saved.');
        } catch { toast.error('Failed to save remark.'); }
        finally { setSavingRemark(false); }
    };

    // ── Handle link client selected ───────────────────────────────────────
    const handleSelectLink = (clientId) => {
        setLinkClientId(clientId);
        setMergeMasterId(null);
        setDecision('link');
    };

    // ── Handle merge master selected ──────────────────────────────────────
    const handleSelectMergeInto = (masterId) => {
        setMergeMasterId(masterId);
        setLinkClientId(null);
        setDecision('merge_clients');
    };

    // ── Execute confirmed action ──────────────────────────────────────────
    const executeAction = async () => {
        setConfirmOpen(false);
        setActing(true);
        try {
            if (decision === 'link') {
                // Link LAF to existing client — server resolves reloan vs pending
                // from the client's actual loan status, not assumed.
                const res = await fetchWrapper.post(getApiBaseUrl() + 'laf/link-to-client', {
                    ciReferenceCode:  application.ciReferenceCode,
                    existingClientId: linkClientId,
                    note,
                });
                if (!res.success) throw new Error(res.message || 'Failed.');
                toast.success(
                    `Done. The application is now linked to the existing client as a ${res.resolvedClientType || 'returning client'}. `
                    + `The branch manager can complete the CI investigation.`
                );

            } else if (decision === 'merge_clients') {
                // Merge two existing client records — destructive, irreversible
                const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/merge', {
                    masterId:   mergeMasterId,
                    duplicateId: mergeTargetId,
                    ciReferenceCode: application.ciReferenceCode,
                });
                if (!res.success) throw new Error(res.message || 'Merge failed.');
                toast.success(`Merge complete. ${res.relinked?.loans || 0} loan(s) moved to the master record. The duplicate has been archived.`);

            } else if (decision === 'different') {
                const res = await fetchWrapper.post(getApiBaseUrl() + 'laf/validate-duplicate', {
                    ciReferenceCode: application.ciReferenceCode,
                    action: 'approve',
                    note,
                });
                if (!res.success) throw new Error(res.message || 'Failed.');
                toast.success('Confirmed. This is a new client — the branch manager can now proceed with CI.');

            } else if (decision === 'decline') {
                const res = await fetchWrapper.post(getApiBaseUrl() + 'laf/validate-duplicate', {
                    ciReferenceCode: application.ciReferenceCode,
                    action: 'decline',
                    note,
                });
                if (!res.success) throw new Error(res.message || 'Failed.');
                toast.success('Application declined.');
            }
            onValidated?.();
        } catch (err) {
            toast.error(err.message || 'Something went wrong.');
        } finally {
            setActing(false);
        }
    };

    // ── Confirm dialog content per decision ───────────────────────────────
    const confirmContent = {
        link: {
            title:       'Link applicant to existing client?',
            message:     `This application will be linked to ${linkClient?.lastName}, ${linkClient?.firstName} as a returning client. The system will automatically determine whether this is a reloan or pending application based on their loan record. The branch manager will then complete the CI investigation as normal.`,
            warning:     null,
            label:       'Yes, link this client',
            cls:         'bg-blue-600 hover:bg-blue-700',
        },
        merge_clients: {
            title:       'Merge two client records?',
            message:     `All loans, collections, and history from "${mergeTarget?.lastName}, ${mergeTarget?.firstName}" will be moved to "${mergeMaster?.lastName}, ${mergeMaster?.firstName}". The other record will be permanently archived.`,
            warning:     'This cannot be undone. Only proceed if you are certain these two records belong to the same person.',
            label:       'Yes, merge records',
            cls:         'bg-red-600 hover:bg-red-700',
        },
        different: {
            title:       'Confirm — different person?',
            message:     'This applicant will proceed as a brand new client. The existing clients with similar names are not affected.',
            warning:     null,
            label:       'Yes, proceed as new client',
            cls:         'bg-green-600 hover:bg-green-700',
        },
        decline: {
            title:       'Decline this application?',
            message:     'The loan application will be rejected. The applicant will need to reapply.',
            warning:     null,
            label:       'Yes, decline',
            cls:         'bg-red-600 hover:bg-red-700',
        },
    }[decision] || {};

    const canConfirm = decision &&
        (decision !== 'link'           || linkClientId)   &&
        (decision !== 'merge_clients'  || (mergeMasterId && mergeTargetId));

    return (
        <>
            {/* Confirmation dialog */}
            {confirmOpen && confirmContent.title && (
                <ConfirmDialog
                    title={confirmContent.title}
                    message={confirmContent.message}
                    warning={confirmContent.warning}
                    confirmLabel={confirmContent.label}
                    confirmCls={confirmContent.cls}
                    onConfirm={executeAction}
                    onCancel={() => setConfirmOpen(false)}
                />
            )}

            <div className="border border-orange-200 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
                    <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">⚠</span>
                        <div>
                            <p className="text-sm font-semibold text-orange-900">
                                Possible Duplicate Client
                            </p>
                            <p className="text-xs text-orange-700 mt-0.5">
                                {candidateIds.length} existing client record
                                {candidateIds.length !== 1 ? 's' : ''} in the system
                                share the same name as this applicant.
                                Admin must review before this application can proceed.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Already validated */}
                    {alreadyValidated && (
                        <div className={`p-3 rounded-xl text-xs border ${
                            ['pending', 'ci_approved'].includes(application.status)
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                            <p className="font-semibold">
                                {application.status === 'pending'     ? '✓ Linked to existing client' :
                                 application.status === 'ci_approved' ? '✓ Approved as new client'    :
                                 '✗ Declined'}
                                {' '}by {application.duplicateValidatedBy}
                            </p>
                            <p className="mt-0.5">
                                {moment(application.duplicateValidatedAt).format('MMM D, YYYY h:mm A')}
                            </p>
                            {application.duplicateValidationNote && (
                                <p className="mt-1 italic">{application.duplicateValidationNote}</p>
                            )}
                        </div>
                    )}

                    {/* How to use this panel — only for admins, only while pending */}
                    {canValidate && isPendingValidation && !alreadyValidated && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl
                            text-xs text-gray-600 space-y-1.5">
                            <p className="font-semibold text-gray-700">What to do here</p>
                            <p>
                                Compare the applicant's photo with each existing client below.
                                Then choose one of these options:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-gray-500 pl-1">
                                <li>
                                    <strong className="text-gray-700">Different person</strong> —
                                    the name match is a coincidence. Process this as a new client.
                                </li>
                                <li>
                                    <strong className="text-gray-700">
                                        Applicant is an existing client applying again
                                    </strong> — click "The applicant is this person" on the
                                    matching record. The application becomes a reloan.
                                </li>
                                {candidates.length === 2 && (
                                    <li>
                                        <strong className="text-gray-700">
                                            Two existing records are the same person
                                        </strong> — click "Keep this record" on the record to keep.
                                        The other record's history will be merged into it and archived.
                                        <span className="text-red-600 font-medium"> Cannot be undone. </span>
                                        The system will always enforce that the client with an
                                        active or completed loan becomes the master record.
                                    </li>
                                )}
                                <li>
                                    <strong className="text-gray-700">Decline</strong> —
                                    reject the application entirely.
                                </li>
                            </ol>
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
                                    applicantLafPhotoUrl={applicantLafPhotoUrl}
                                    selectedForLink={linkClientId === cl._id}
                                    selectedForMerge={mergeMasterId === cl._id}
                                    mergeTargetId={mergeTargetId}
                                    onSelectLink={handleSelectLink}
                                    onSelectMergeInto={handleSelectMergeInto}
                                    canDecide={canValidate && isPendingValidation && !alreadyValidated}
                                    allCandidates={candidates}
                                />
                            ))}
                        </div>
                    ) : candidateIds.length > 0 ? (
                        <p className="text-xs text-gray-400">
                            {candidateIds.length} candidate(s) — records could not be loaded.
                        </p>
                    ) : null}

                    {/* BM remark */}
                    <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                            Branch Manager Remark
                        </p>
                        {isBM && isPendingValidation && !alreadyValidated ? (
                            <div className="space-y-2">
                                <textarea value={bmRemark}
                                    onChange={e => setBmRemark(e.target.value)}
                                    placeholder="Add any notes that will help the admin decide — e.g. client showed valid ID, confirmed they are a new applicant..."
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs border border-gray-200
                                        rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400
                                        resize-none" />
                                <button type="button" onClick={handleSaveRemark}
                                    disabled={savingRemark || !bmRemark.trim()}
                                    className="px-3 py-1.5 bg-gray-700 text-white text-xs font-medium
                                        rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                                    {savingRemark ? 'Saving...' : 'Save Remark'}
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-600 italic p-2 bg-gray-50 rounded-lg">
                                {application?.duplicateValidationNote || 'No remark from branch manager.'}
                            </p>
                        )}
                    </div>

                    {/* Admin decision section */}
                    {canValidate && isPendingValidation && !alreadyValidated && (
                        <div className="space-y-3 pt-3 border-t border-orange-100">
                            {/* Quick decision buttons — Different / Decline */}
                            <p className="text-xs font-semibold text-gray-700">
                                Or choose without selecting a record above:
                            </p>
                            <div className="flex gap-2">
                                <button type="button"
                                    onClick={() => {
                                        setDecision('different');
                                        setLinkClientId(null);
                                        setMergeMasterId(null);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5
                                        rounded-xl border-2 text-xs font-semibold transition-colors ${
                                        decision === 'different'
                                            ? 'border-green-500 bg-green-50 text-green-800'
                                            : 'border-gray-200 text-gray-600 hover:border-green-300'
                                    }`}>
                                    <CheckCircle className="w-4 h-4" />
                                    Different Person — New Client
                                </button>
                                <button type="button"
                                    onClick={() => {
                                        setDecision('decline');
                                        setLinkClientId(null);
                                        setMergeMasterId(null);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5
                                        rounded-xl border-2 text-xs font-semibold transition-colors ${
                                        decision === 'decline'
                                            ? 'border-red-500 bg-red-50 text-red-800'
                                            : 'border-gray-200 text-gray-600 hover:border-red-300'
                                    }`}>
                                    <XCircle className="w-4 h-4" />
                                    Decline Application
                                </button>
                            </div>

                            {/* Current selection summary */}
                            {decision && (
                                <div className={`p-3 rounded-xl text-xs border ${
                                    decision === 'link'          ? 'bg-blue-50 border-blue-200 text-blue-800'    :
                                    decision === 'merge_clients' ? 'bg-purple-50 border-purple-200 text-purple-800' :
                                    decision === 'different'     ? 'bg-green-50 border-green-200 text-green-800' :
                                                                   'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                    {decision === 'link' && linkClient && (
                                        <>
                                            <p className="font-semibold mb-0.5">
                                                Selected: Link to existing client
                                            </p>
                                            <p>
                                                The LAF will be linked to{' '}
                                                <strong>{linkClient.lastName}, {linkClient.firstName}</strong>
                                                {' '}({linkClient.status}) as a returning client — the system will
                                                determine reloan or pending based on their loan record.
                                                All other matching records are unaffected.
                                            </p>
                                        </>
                                    )}
                                    {decision === 'merge_clients' && mergeMaster && mergeTarget && (
                                        <>
                                            <p className="font-semibold mb-0.5">
                                                Selected: Merge client records
                                            </p>
                                            <p>
                                                <strong>{mergeTarget.lastName}, {mergeTarget.firstName}</strong>
                                                {' '}({mergeTarget.status}) will be archived.
                                                Their loans and history move to{' '}
                                                <strong>{mergeMaster.lastName}, {mergeMaster.firstName}</strong>
                                                {' '}({mergeMaster.status}).
                                            </p>
                                            <p className="mt-1 text-amber-600 text-xs">
                                                ℹ The system enforces that the client with an
                                                active or completed loan is always the master.
                                                If the system detects the other client has the
                                                active loan, it will swap master automatically
                                                and notify you in the result.
                                            </p>
                                            <p className="mt-1 text-red-600 font-medium">
                                                ⚠ This cannot be undone.
                                            </p>
                                        </>
                                    )}
                                    {decision === 'different' && (
                                        <p>
                                            <strong>Different person.</strong>{' '}
                                            Proceed as a new client. No existing records are changed.
                                        </p>
                                    )}
                                    {decision === 'decline' && (
                                        <p>
                                            <strong>Decline.</strong>{' '}
                                            The application will be rejected.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Optional admin note */}
                            <textarea value={note} onChange={e => setNote(e.target.value)}
                                placeholder="Add a note explaining your decision (optional)..."
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg
                                    focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />

                            {/* Confirm button */}
                            <button type="button"
                                onClick={() => setConfirmOpen(true)}
                                disabled={acting || !canConfirm}
                                className={`w-full py-3 text-white text-sm font-semibold rounded-xl
                                    disabled:opacity-40 transition-colors ${
                                    decision === 'merge_clients' ? 'bg-purple-600 hover:bg-purple-700' :
                                    decision === 'decline'       ? 'bg-red-600 hover:bg-red-700'       :
                                    decision === 'different'     ? 'bg-green-600 hover:bg-green-700'   :
                                    decision === 'link'          ? 'bg-blue-600 hover:bg-blue-700'     :
                                                                   'bg-gray-400'
                                }`}>
                                {acting ? 'Processing...' :
                                    !decision                         ? 'Select an action above first' :
                                    decision === 'link' && !linkClientId ? 'Select a client above first' :
                                    decision === 'merge_clients' && !mergeMasterId ? 'Select which record to keep above' :
                                    'Review & Confirm →'}
                            </button>
                        </div>
                    )}

                    {/* BM waiting message */}
                    {isPendingValidation && !canValidate && !alreadyValidated && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl
                            text-xs text-amber-700">
                            <p className="font-semibold mb-0.5">Waiting for review</p>
                            <p>
                                A system administrator, supervisor, or branch manager needs to check the matching records and decide how to proceed. You can add a remark above to help them make the right decision.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CIDuplicatePanel;