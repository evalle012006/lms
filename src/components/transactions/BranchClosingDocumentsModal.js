// src/components/transactions/BranchClosingDocumentsModal.js
// BM-facing modal: MULTIPLE files allowed per category for the whole
// branch/day. Enable the trigger button only when
// branch-check.readyToUpload === true.

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
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
    onClosed, // callback after branch successfully closes
}) {
    // CHANGED: existingDocs[docType] is now an ARRAY of files, not a single
    // object — multiple files can be simultaneously active per type.
    const [existingDocs, setExistingDocs] = useState({}); // { [docType]: DocInfo[] }
    const [initialLoading, setInitialLoading] = useState(true);
    // CHANGED: pendingFiles[docType] is now an ARRAY of File objects.
    const [pendingFiles, setPendingFiles] = useState({}); // { [docType]: File[] }
    const [uploading, setUploading] = useState(false);
    const [closing, setClosing] = useState(false);
    const [viewerKey, setViewerKey] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setInitialLoading(true);
            loadExisting();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, branchId, dateFor]);

    const loadExisting = async () => {
        const url = `${getApiBaseUrl()}transactions/closing-documents/list?` +
            new URLSearchParams({ branchId, dateFor });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            // CHANGED: server now returns documentsByType directly (already
            // grouped as arrays) — no client-side map-building needed.
            setExistingDocs(response.documentsByType || {});
        } else {
            toast.error(response.message || 'Failed to load existing documents.');
        }
        setInitialLoading(false);
    };

    const handleFileSelect = (docType, fileList) => {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;

        const maxBytes = getClosingDocMaxBytes(docType);
        const oversized = files.find(f => f.size > maxBytes);
        if (oversized) {
            toast.error(`"${oversized.name}" is too large. Max ${(maxBytes / (1024 * 1024)).toFixed(0)}MB for this document.`);
            return;
        }

        // CHANGED: append to the array rather than replace — selecting more
        // files for the same type adds to what's already pending, it
        // doesn't overwrite a previous selection.
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

        // upload.js computes and persists the authoritative version
        // server-side (max existing + 1) — the client's guess here is only
        // used to keep the Spaces object path readably versioned; it is
        // not trusted for anything functional.
        const saveResponse = await fetchWrapper.post(
            `${getApiBaseUrl()}transactions/closing-documents/upload`,
            { branchId, dateFor, docType, fileKey: uploadResult.fileKey },
        );
        if (!saveResponse.success) throw new Error(saveResponse.message || `Save failed for ${docType}`);
    };

    const handleUploadAll = async () => {
        const entries = Object.entries(pendingFiles).filter(([, files]) => files.length > 0);
        if (entries.length === 0) return;

        setUploading(true);
        try {
            for (const [docType, files] of entries) {
                // CHANGED: version guess now accounts for however many
                // files already exist for this type, incrementing per file
                // within this same batch too (so uploading 3 files at once
                // for one type gets 3 distinct, increasing version numbers
                // in their Spaces paths, not all colliding on the same one).
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

    // CHANGED: a type counts as "uploaded" if it has at least one file,
    // not exactly one.
    const allUploaded = CLOSING_DOC_TYPES.every(d => (existingDocs[d.key] || []).length > 0);

    const FINAL_CLOSE_ALLOWED_SHORTCODES = ['admin', 'deputy_director', 'regional_manager', 'area_admin'];
    const canFinalize = FINAL_CLOSE_ALLOWED_SHORTCODES.includes(currentUser?.role?.shortCode);

    const UPLOAD_ALLOWED_SHORTCODES = ['admin', 'branch_manager'];
    const canUpload = UPLOAD_ALLOWED_SHORTCODES.includes(currentUser?.role?.shortCode);

    // CHANGED: every INDIVIDUAL active file must be acknowledged now, not
    // one flag per type — flatten every type's array and check each file.
    const allAcknowledged = CLOSING_DOC_TYPES.every(d =>
        (existingDocs[d.key] || []).every(doc => doc.acknowledged)
    );

    // Helper to update one specific file's entry within its type's array —
    // used by both the optimistic view-count bump and the acknowledge update.
    const updateDocInArray = (docType, docId, patch) => {
        setExistingDocs(prev => ({
            ...prev,
            [docType]: (prev[docType] || []).map(d => d.id === docId ? { ...d, ...patch } : d),
        }));
    };

    const handleViewDocument = async (doc) => {
        setViewerKey(doc.fileKey);

        // Optimistic local update — see prior notes: the server call below
        // tells the DB, but nothing tells the UI without this. Bumping the
        // specific file's viewCount unlocks its own checkbox immediately.
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

                <div className="p-4 space-y-3 overflow-y-auto flex-1">
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

                                    {canUpload && (
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
                                    {/* Pending (not-yet-uploaded) files for this type */}
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

                                    {/* Already-uploaded files for this type — each with its own
                                        view/acknowledge state, since each is independently reviewed */}
                                    {existingList.map(doc => (
                                        <div key={doc.id} className="border-t border-gray-50 pt-2 first:border-t-0 first:pt-0">
                                            <div className="flex items-center justify-between gap-3">
                                                <button
                                                    type="button"
                                                    className="text-xs text-blue-600 underline"
                                                    onClick={() => handleViewDocument(doc)}
                                                >
                                                    View uploaded (v{doc.version})
                                                </button>

                                                {canFinalize && (
                                                    <label
                                                        className={`flex items-center gap-1.5 text-xs shrink-0 ${
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
                                    ))}

                                    {existingList.length === 0 && pendingList.length === 0 && (
                                        <p className="text-xs text-gray-400">Not uploaded</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t flex justify-between gap-2 shrink-0">
                    {canUpload && (
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
                        disabled={!allUploaded || closing || !canFinalize || !allAcknowledged}
                        title={
                            !canFinalize && allUploaded ? 'Only an Area Manager or above can finalize this closing'
                            : canFinalize && allUploaded && !allAcknowledged ? 'Review and check off every uploaded file before finalizing'
                            : undefined
                        }
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        {closing
                            ? 'Closing...'
                            : (allUploaded && !canFinalize)
                                ? 'Awaiting AM Approval'
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
        </div>
    );
}