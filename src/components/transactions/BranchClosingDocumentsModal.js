// src/components/transactions/BranchClosingDocumentsModal.js
// BM-facing modal, two clearly separated sections:
//   1. Cash on Hand — total + optional breakdown, explicit Save button
//   2. Closing Documents — multiple files allowed per category, each
//      independently viewed/reviewed/removable/replaceable
// Enable the trigger button only when branch-check.readyToUpload === true.

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Eye, Trash2, Plus, RefreshCw as ReplaceIcon } from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { CLOSING_DOC_TYPES, getClosingDocMaxBytes } from '@/lib/closing-documents.constants';
import DocumentViewerModal from './DocumentViewerModal';

export default function BranchClosingDocumentsModal({
    isOpen,
    onClose,
    branchId,
    branchName,
    dateFor,
    currentUser,
    onClosed,
    cohAmount,
    cohBreakdown,
    onCohAmountChange,
    onCohSave,
}) {
    const [existingDocs, setExistingDocs] = useState({});
    const [initialLoading, setInitialLoading] = useState(true);
    const [pendingFiles, setPendingFiles] = useState({});
    const [uploading, setUploading] = useState(false);
    const [closing, setClosing] = useState(false);
    const [viewerKey, setViewerKey] = useState(null);
    const [branchClosed, setBranchClosed] = useState(false);
    const [pendingAction, setPendingAction] = useState(null); // { type: 'remove' | 'replace', doc }
    const [actionLoading, setActionLoading] = useState(false); // spinner for the confirm modal's Remove action
    const [replacingDoc, setReplacingDoc] = useState(null); // the OLD doc currently being replaced — set the moment the file picker opens, cleared once resolved
    const [replaceInProgressId, setReplaceInProgressId] = useState(null); // OLD doc's id, for per-row spinner while upload+remove runs

    const [breakdownDraft, setBreakdownDraft] = useState(cohBreakdown || []);
    const [cohSaving, setCohSaving] = useState(false);
    const [cohDirty, setCohDirty] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setInitialLoading(true);
            loadExisting();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, branchId, dateFor]);

    useEffect(() => {
        // FIXED: this used to unconditionally overwrite breakdownDraft
        // whenever cohBreakdown's reference changed — including spurious
        // changes from unrelated parent re-renders (e.g. the 30s
        // readiness poll causing `cohData?.breakdown || []` to produce a
        // fresh empty array literal every render). That silently wiped
        // out unsaved local edits mid-typing. Now it only syncs when
        // there's nothing unsaved to lose — cohDirty is the actual
        // signal that matters here, not whether the prop reference moved.
        if (!cohDirty) {
            setBreakdownDraft(cohBreakdown || []);
        }
    }, [cohBreakdown, cohDirty]);

    const loadExisting = async () => {
        const url = `${getApiBaseUrl()}transactions/closing-documents/list?` +
            new URLSearchParams({ branchId, dateFor });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            setExistingDocs(response.documentsByType || {});
            setBranchClosed(response.branchClosed || false);
        } else {
            toast.error(response.message || 'Failed to load existing documents.');
        }
        setInitialLoading(false);
    };

    const handleCohAmountChange = (value) => {
        onCohAmountChange(value);
        setCohDirty(true);
    };

    const updateBreakdownLine = (index, field, value) => {
        setBreakdownDraft(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
        setCohDirty(true);
    };

    const addBreakdownLine = () => {
        setBreakdownDraft(prev => [...prev, { label: '', amount: '' }]);
        setCohDirty(true);
    };

    const removeBreakdownLine = (index) => {
        setBreakdownDraft(prev => prev.filter((_, i) => i !== index));
        setCohDirty(true);
    };

    const handleSaveCoh = async () => {
        setCohSaving(true);
        await onCohSave(cohAmount, breakdownDraft);
        setCohSaving(false);
        setCohDirty(false);
    };

    const handleFileSelect = (docType, fileList) => {
        // CHANGED: if a replace is in progress for THIS doc type, route to
        // the dedicated replace-upload path instead of the normal
        // stage-then-batch-upload flow. Replace uploads immediately and
        // only removes the old file after that upload actually succeeds —
        // it does not use the pendingFiles staging area at all.
        if (replacingDoc && replacingDoc.docType === docType) {
            const file = fileList?.[0];
            const oldDoc = replacingDoc;
            setReplacingDoc(null);
            if (file) {
                handleReplaceUpload(oldDoc, file);
            }
            return;
        }

        const files = Array.from(fileList || []);
        if (files.length === 0) return;

        const maxBytes = getClosingDocMaxBytes(docType);
        const oversized = files.find(f => f.size > maxBytes);
        if (oversized) {
            toast.error(`"${oversized.name}" is too large. Max ${(maxBytes / (1024 * 1024)).toFixed(0)}MB for this document.`);
            return;
        }

        setPendingFiles(prev => ({
            ...prev,
            [docType]: [...(prev[docType] || []), ...files],
        }));
    };

    const removePendingFile = (docType, index) => {
        setPendingFiles(prev => ({
            ...prev,
            [docType]: (prev[docType] || []).filter((_, i) => i !== index),
        }));
    };

    const uploadOne = async (docType, file, nextVersion) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('origin', 'branch-closing-documents');
        formData.append('uuid', `${branchId}/${dateFor}/${docType}/v${nextVersion}`);

        const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.fileKey) throw new Error(`Upload failed for ${docType}`);

        const saveResponse = await fetchWrapper.post(
            `${getApiBaseUrl()}transactions/closing-documents/upload`,
            { branchId, dateFor, docType, fileKey: uploadResult.fileKey },
        );
        if (!saveResponse.success) throw new Error(saveResponse.message || `Save failed for ${docType}`);
    };

    // CHANGED: this is the actual fix — Replace now uploads the new file
    // FIRST, and only removes the old one after that upload succeeds. If
    // the upload fails for any reason, the old file is untouched. Previous
    // behavior removed the old file immediately on confirm, before any
    // replacement existed — meaning a cancelled file picker, a failed
    // upload, or any interruption left the document type with nothing at
    // all. This is not optional polish; it was a real data-loss risk.
    const handleReplaceUpload = async (oldDoc, file) => {
        const maxBytes = getClosingDocMaxBytes(oldDoc.docType);
        if (file.size > maxBytes) {
            toast.error(`"${file.name}" is too large. Max ${(maxBytes / (1024 * 1024)).toFixed(0)}MB for this document.`);
            return;
        }

        setReplaceInProgressId(oldDoc.id);
        try {
            const nextVersion = Math.max(0, ...(existingDocs[oldDoc.docType] || []).map(d => d.version)) + 1;
            await uploadOne(oldDoc.docType, file, nextVersion);

            // New file is confirmed saved — now, and only now, remove the old one.
            const removeResponse = await removeDocumentCall(oldDoc);
            if (!removeResponse.success) {
                // Upload succeeded but removal failed — don't hide this as
                // a generic error. The branch now has BOTH files active,
                // which is recoverable (just remove the old one manually)
                // but the person needs to know, not just see a green toast.
                toast.error(`New file uploaded, but the old one could not be removed automatically: ${removeResponse.message || 'unknown error'}. Please remove it manually.`);
            } else {
                toast.success('Document replaced.');
            }
            await loadExisting();
        } catch (err) {
            toast.error(err.message || 'Failed to upload replacement file. The original file was not removed.');
        }
        setReplaceInProgressId(null);
    };

    const handleUploadAll = async () => {
        const entries = Object.entries(pendingFiles).filter(([, files]) => files.length > 0);
        if (entries.length === 0) return;

        setUploading(true);
        try {
            for (const [docType, files] of entries) {
                let runningMax = Math.max(0, ...(existingDocs[docType] || []).map(d => d.version));
                for (const file of files) {
                    runningMax += 1;
                    await uploadOne(docType, file, runningMax);
                }
            }
            toast.success('Documents uploaded.');
            setPendingFiles({});
            await loadExisting();
        } catch (err) {
            toast.error(err.message || 'Failed to upload documents.');
        }
        setUploading(false);
    };

    const allUploaded = CLOSING_DOC_TYPES.every(d => (existingDocs[d.key] || []).length > 0);

    const FINAL_CLOSE_ALLOWED_SHORTCODES = ['admin', 'deputy_director', 'regional_manager', 'area_admin'];
    const canFinalize = FINAL_CLOSE_ALLOWED_SHORTCODES.includes(currentUser?.role?.shortCode);

    const UPLOAD_ALLOWED_SHORTCODES = ['admin', 'branch_manager'];
    const canUpload = UPLOAD_ALLOWED_SHORTCODES.includes(currentUser?.role?.shortCode);

    const allAcknowledged = CLOSING_DOC_TYPES.every(d =>
        (existingDocs[d.key] || []).every(doc => doc.acknowledged)
    );

    const updateDocInArray = (docType, docId, patch) => {
        setExistingDocs(prev => ({
            ...prev,
            [docType]: (prev[docType] || []).map(d => d.id === docId ? { ...d, ...patch } : d),
        }));
    };

    const handleViewDocument = async (doc) => {
        setViewerKey(doc.fileKey);
        updateDocInArray(doc.docType, doc.id, { viewCount: (doc.viewCount || 0) + 1 });
        fetchWrapper.post(
            `${getApiBaseUrl()}transactions/closing-documents/log-view`,
            { branchId, dateFor, docType: doc.docType, version: doc.version },
        ).catch(err => console.error('Failed to log document view:', err));
    };

    const handleAcknowledge = async (doc) => {
        const response = await fetchWrapper.post(
            `${getApiBaseUrl()}transactions/closing-documents/acknowledge`,
            { branchId, dateFor, docType: doc.docType, version: doc.version },
        );
        if (response.success) {
            updateDocInArray(doc.docType, doc.id, {
                acknowledged: true,
                acknowledgedAt: new Date().toISOString(),
                reviewedByName: `${currentUser.firstName} ${currentUser.lastName}`,
            });
        } else {
            toast.error(response.message || 'Failed to acknowledge document.');
        }
    };

    const removeDocumentCall = async (doc) => {
        const response = await fetchWrapper.post(
            `${getApiBaseUrl()}transactions/closing-documents/remove`,
            { documentId: doc.id, branchId, dateFor },
        );
        if (response.success) {
            setExistingDocs(prev => ({
                ...prev,
                [doc.docType]: (prev[doc.docType] || []).filter(d => d.id !== doc.id),
            }));
        }
        return response;
    };

    // CHANGED: replaces the timeout-based two-click confirm with a real
    // modal — a silent state change on the button itself was too easy to
    // miss, especially with a 3-second auto-disarm window.
    const executeRemove = async (doc) => {
        setActionLoading(true);
        const response = await removeDocumentCall(doc);
        setActionLoading(false);
        if (response.success) {
            toast.success('Document removed.');
        } else {
            toast.error(response.message || 'Failed to remove document.');
        }
    };

    // Replace no longer touches the API at all at this stage — confirming
    // just arms replacingDoc and opens the file picker. The actual
    // upload+remove sequence happens in handleReplaceUpload, only once a
    // file is actually selected and successfully uploaded.
    const startReplace = (doc) => {
        setReplacingDoc(doc);
        document.getElementById(`file-input-${doc.docType}`)?.click();
    };

    const handleFinalClose = async () => {
        setClosing(true);
        const response = await fetchWrapper.post(
            `${getApiBaseUrl()}transactions/cash-collections/update-group-transaction-status`,
            {
                branchId,
                mode: 'close',
                currentDate: dateFor,
                userId: currentUser._id,
                userName: `${currentUser.firstName} ${currentUser.lastName}`,
                isAdmin: currentUser.role.rep === 1,
            },
        );
        setClosing(false);

        if (response.success) {
            toast.success('Branch closed.');
            onClosed?.();
            onClose();
        } else {
            toast.error(response.message || 'Failed to close branch.');
        }
    };

    // ADDED: live sum of breakdown lines, purely informational — does not
    // gate or validate anything, matches the confirmed "supporting detail
    // only" design. Lets BM sanity-check their own entries at a glance
    // without needing to add it up externally.
    // FIXED: this was referenced by the finalize button below but never
    // actually declared — a straight ReferenceError that would have
    // thrown on every render once the button's disabled expression was
    // evaluated. Same mistake as the approvalRecord bug in branch-check.js
    // a few messages back: the instruction to add this was given, only
    // the usage made it into the file, not the declaration itself.
    const cohValid = (() => {
        if (cohAmount === null || cohAmount === undefined || cohAmount === '') return false;
        const numeric = Number(String(cohAmount).replace(/,/g, ''));
        return !isNaN(numeric) && numeric >= 0;
    })();

    const breakdownSum = breakdownDraft.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
    const formatPeso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold">Branch closing documents</h2>
                        <p className="text-sm text-gray-500">{branchName} — {dateFor}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">✕</button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1">

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">1</span>
                            <h3 className="text-sm font-semibold text-gray-900">Cash on Hand</h3>
                        </div>

                        <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs text-gray-500 shrink-0">Total COH:</span>
                                <input
                                    type="number"
                                    value={cohAmount}
                                    onChange={e => handleCohAmountChange(e.target.value)}
                                    disabled={!canUpload}
                                    className="w-32 px-2 py-1 text-sm border rounded bg-white focus:ring-1 focus:ring-blue-400"
                                    placeholder="0.00"
                                />
                            </div>

                            <p className="text-xs text-gray-500 mb-2">
                                Optional breakdown — supporting detail only, does not need to
                                match the total above.
                            </p>

                            {breakdownDraft.length === 0 ? (
                                canUpload ? (
                                    <div className="border border-dashed border-blue-200 rounded-md py-4 text-center">
                                        <p className="text-xs text-gray-400 mb-1.5">No breakdown items yet</p>
                                        <button
                                            type="button"
                                            onClick={addBreakdownLine}
                                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                                        >
                                            <Plus size={12} /> Add line
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400">No breakdown provided.</p>
                                )
                            ) : (
                                <>
                                    {/* Column headers — only worth showing once there's
                                        something to line up against */}
                                    <div className="flex gap-2 items-center px-1 mb-1">
                                        <span className="w-4 shrink-0" />
                                        <span className="flex-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide">Description</span>
                                        <span className="w-24 shrink-0 text-[10px] font-medium text-gray-400 uppercase tracking-wide text-right">Amount</span>
                                        {canUpload && <span className="w-6 shrink-0" />}
                                    </div>

                                    <div className="space-y-1.5">
                                        {breakdownDraft.map((line, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <span className="w-4 shrink-0 text-[10px] text-gray-300 text-right tabular-nums">{i + 1}</span>
                                                <input
                                                    type="text"
                                                    placeholder="Description"
                                                    value={line.label}
                                                    onChange={e => updateBreakdownLine(i, 'label', e.target.value)}
                                                    disabled={!canUpload}
                                                    className="flex-1 px-2 py-1 text-xs border rounded bg-white"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={line.amount}
                                                    onChange={e => updateBreakdownLine(i, 'amount', e.target.value)}
                                                    disabled={!canUpload}
                                                    className="w-24 px-2 py-1 text-xs border rounded bg-white text-right tabular-nums"
                                                />
                                                {canUpload && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBreakdownLine(i)}
                                                        title="Remove this line"
                                                        className="w-6 shrink-0 flex items-center justify-center text-gray-300 hover:text-red-500"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Live sum, informational only — a soft visual cue when
                                        it happens to match the typed total, never a hard
                                        validation or block. */}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-100/70 px-1">
                                        {canUpload && (
                                            <button
                                                type="button"
                                                onClick={addBreakdownLine}
                                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                            >
                                                <Plus size={12} /> Add line
                                            </button>
                                        )}
                                        <div className="text-xs text-gray-500 ml-auto flex items-center gap-1.5">
                                            <span>Breakdown total: <span className="font-medium tabular-nums">{formatPeso(breakdownSum)}</span></span>
                                            {parseFloat(cohAmount || 0) === breakdownSum && breakdownSum > 0 && (
                                                <span className="text-green-600" title="Matches total COH">✓</span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {canUpload && (
                                <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between">
                                    <span className={`text-xs ${cohDirty ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                        {cohDirty ? 'Unsaved changes' : 'Saved'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleSaveCoh}
                                        disabled={cohSaving || !cohDirty}
                                        className="px-3 py-1.5 text-xs font-medium border rounded bg-white disabled:opacity-50"
                                    >
                                        {cohSaving ? 'Saving...' : 'Save COH'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">2</span>
                            <h3 className="text-sm font-semibold text-gray-900">Closing Documents</h3>
                        </div>

                        <div className="space-y-3">
                            {initialLoading ? (
                                <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Loading documents...
                                </div>
                            ) : CLOSING_DOC_TYPES.map(({ key, label, maxMB }) => {
                                const existingList = existingDocs[key] || [];
                                const pendingList = pendingFiles[key] || [];
                                const inputRef = `file-input-${key}`;

                                return (
                                    <div key={key} className="border rounded-lg p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-gray-900">{label}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">Max {maxMB}MB per file</p>
                                            </div>

                                            {canUpload && !branchClosed && (
                                                <>
                                                    <label
                                                        htmlFor={inputRef}
                                                        className="shrink-0 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md
                                                            text-gray-700 bg-white hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                                                    >
                                                        Add File(s)
                                                    </label>
                                                    <input
                                                        id={inputRef}
                                                        type="file"
                                                        multiple
                                                        onChange={e => { handleFileSelect(key, e.target.files); e.target.value = ''; }}
                                                        className="hidden"
                                                    />
                                                </>
                                            )}
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                                            {pendingList.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2">
                                                    <p className="text-xs text-amber-600 truncate" title={file.name}>
                                                        Selected: {file.name} — not uploaded yet
                                                    </p>
                                                    {canUpload && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePendingFile(key, idx)}
                                                            className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            ))}

                                            {existingList.map(doc => {
                                                // ADDED: extract the actual stored filename from fileKey
                                                // (e.g. ".../v2/receipt_scan.pdf" → "receipt_scan.pdf").
                                                // Note this is the SANITIZED name upload.js stored it
                                                // under (lowercased, special characters stripped) —
                                                // not necessarily byte-identical to what the user saw
                                                // in their OS file picker, but it's what's actually
                                                // downloadable, which is the more useful thing to show.
                                                const displayName = doc.fileKey.split('/').pop();
                                                const isReplacing = replaceInProgressId === doc.id;

                                                // ADDED: while this doc's replacement is uploading, show a
                                                // clear in-progress row instead of the normal controls —
                                                // this is the visible feedback that was missing entirely
                                                // before (the old flow gave no indication anything was
                                                // happening between confirm and the eventual toast).
                                                if (isReplacing) {
                                                    return (
                                                        <div key={doc.id} className="border-t border-gray-50 pt-2 first:border-t-0 first:pt-0">
                                                            <div className="flex items-center gap-2 text-xs text-blue-600">
                                                                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                </svg>
                                                                Uploading replacement...
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                <div key={doc.id} className="border-t border-gray-50 pt-2 first:border-t-0 first:pt-0">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <button
                                                            type="button"
                                                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline min-w-0"
                                                            onClick={() => handleViewDocument(doc)}
                                                            title={`${displayName} (v${doc.version})`}
                                                        >
                                                            <Eye size={13} className="shrink-0" />
                                                            <span className="truncate max-w-[220px]">{displayName}</span>
                                                            <span className="text-gray-400 shrink-0">v{doc.version}</span>
                                                        </button>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {canUpload && !branchClosed && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPendingAction({ type: 'replace', doc })}
                                                                        title="Replace this file"
                                                                        className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                                    >
                                                                        <ReplaceIcon size={14} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPendingAction({ type: 'remove', doc })}
                                                                        title="Remove this file"
                                                                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </>
                                                            )}

                                                            {canFinalize && (
                                                                <label
                                                                    className={`flex items-center gap-1.5 text-xs ${
                                                                        doc.acknowledged
                                                                            ? 'text-green-700'
                                                                            : doc.viewCount > 0
                                                                                ? 'text-gray-700 cursor-pointer'
                                                                                : 'text-gray-300 cursor-not-allowed'
                                                                    }`}
                                                                    title={
                                                                        doc.acknowledged
                                                                            ? 'Reviewed'
                                                                            : doc.viewCount > 0
                                                                                ? 'Mark as reviewed'
                                                                                : 'View the document before acknowledging it'
                                                                    }
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!doc.acknowledged}
                                                                        disabled={doc.acknowledged || !doc.viewCount}
                                                                        onChange={() => handleAcknowledge(doc)}
                                                                        className="h-3.5 w-3.5"
                                                                    />
                                                                    {doc.acknowledged ? 'Reviewed' : 'Mark as reviewed'}
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-1 text-[11px] text-gray-500 space-y-0.5">
                                                        <p>
                                                            Uploaded by {doc.uploadedByName || 'unknown'} on{' '}
                                                            {new Date(doc.uploadedAt).toLocaleString()}
                                                        </p>
                                                        {doc.acknowledged && (
                                                            <p>
                                                                Reviewed by {doc.reviewedByName || 'unknown'} on{' '}
                                                                {doc.acknowledgedAt ? new Date(doc.acknowledgedAt).toLocaleString() : ''}
                                                            </p>
                                                        )}
                                                        {doc.predatesReopen && (
                                                            <p className="text-amber-600 font-medium">
                                                                ⚠ Not updated since branch was reopened — confirm this file still applies
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                );
                                            })}

                                            {existingList.length === 0 && pendingList.length === 0 && (
                                                <p className="text-xs text-gray-400">Not uploaded</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t flex justify-between gap-2 shrink-0">
                    {canUpload && !branchClosed && (
                        <button
                            onClick={handleUploadAll}
                            disabled={uploading || Object.values(pendingFiles).every(arr => !arr || arr.length === 0)}
                            className="px-4 py-2 text-sm border rounded disabled:opacity-50"
                        >
                            {uploading ? 'Uploading...' : 'Upload selected'}
                        </button>
                    )}
                    <button
                        onClick={handleFinalClose}
                        disabled={!allUploaded || closing || !canFinalize || !allAcknowledged || cohDirty || !cohValid}
                        title={
                            !canFinalize && allUploaded ? 'Only an Area Manager or above can finalize this closing'
                            : !cohValid ? 'Enter a valid Cash on Hand amount before finalizing'
                            : cohDirty ? 'Save Cash on Hand before finalizing'
                            : canFinalize && allUploaded && !allAcknowledged ? 'Review and check off every uploaded file before finalizing'
                            : undefined
                        }
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        {closing
                            ? 'Closing...'
                            : (allUploaded && !canFinalize)
                                ? 'Awaiting AM Approval'
                                : !cohValid
                                    ? 'Enter a valid Cash on Hand amount'
                                    : cohDirty
                                        ? 'Save Cash on Hand to continue'
                                        : (canFinalize && allUploaded && !allAcknowledged)
                                            ? 'Review all documents to continue'
                                            : 'Confirm final closing'}
                    </button>
                </div>
            </div>

            {viewerKey && (
                <DocumentViewerModal
                    isOpen={!!viewerKey}
                    onClose={() => setViewerKey(null)}
                    documentUrl={viewerKey}
                />
            )}

            {pendingAction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[210]">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <div className="p-5 border-b">
                            <h3 className="text-sm font-semibold text-gray-900">
                                {pendingAction.type === 'remove' ? 'Remove this file?' : 'Replace this file?'}
                            </h3>
                        </div>
                        <div className="p-5">
                            <p className="text-sm text-gray-600">
                                {pendingAction.type === 'remove'
                                    ? 'This will remove the uploaded file. This cannot be undone.'
                                    : 'You will be asked to select a replacement file. The current file is only removed after the new one finishes uploading successfully.'}
                            </p>
                            <p className="mt-2 text-xs text-gray-400 truncate">
                                {pendingAction.doc.fileKey.split('/').pop()}
                            </p>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button
                                onClick={() => setPendingAction(null)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    const { type, doc } = pendingAction;
                                    if (type === 'remove') {
                                        // CHANGED: modal stays open with a
                                        // spinner until the request actually
                                        // resolves — was closing immediately
                                        // on click, so the deletion happened
                                        // silently with no visible feedback
                                        // for however long the request took.
                                        await executeRemove(doc);
                                        setPendingAction(null);
                                    } else {
                                        // Replace makes no API call here at
                                        // all — just closes this dialog and
                                        // opens the file picker.
                                        setPendingAction(null);
                                        startReplace(doc);
                                    }
                                }}
                                disabled={actionLoading}
                                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading && (
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                )}
                                {actionLoading ? 'Removing...' : (pendingAction.type === 'remove' ? 'Remove' : 'Replace')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}