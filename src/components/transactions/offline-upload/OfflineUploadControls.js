// src/components/transactions/offline-upload/OfflineUploadControls.js
//
// Download / Upload buttons for the LOR group pages (daily + weekly), rendered through the
// `exportComponent` slot of the group DetailsHeader. All the logic lives in lib/offline-upload/*:
// this file only wires it to the page and shows the preview.
//
// Flow:  Download template -> fill in Excel -> Upload -> preview (nothing is saved yet)
//        -> reason + Confirm -> POST offline-upload/commit -> page reloads with the new drafts.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '@/lib/ui/Modal';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl, LOR_DAILY_REMARKS, LOR_WEEKLY_REMARKS } from '@/lib/constants';
import { CASH_COLLECTIONS_FIELDS } from '@/lib/graph.fields';
import { safeNumber } from '@/lib/utils';
import { canUseOfflineUpload } from '@/lib/offline-upload/permissions';
import { createRowEngine, UPLOAD_BLOCKED_REMARKS } from '@/lib/offline-upload/lor-row-engine';
import {
    TEMPLATE_VERSION, applyTemplate, buildTemplate, checkTemplateAgainstPage, getUploadBlockers, parseTemplate,
    selectUploadableRows, sha256Hex,
} from '@/lib/offline-upload/lor-upload-template';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const buttonClass = `flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg
    hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200`;

const triggerDownload = (buffer, fileName) => {
    const url = window.URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const OfflineUploadControls = ({
    mode,               // 'daily' | 'weekly'
    rows,               // the page's `data` (rows as loaded, plus blank and totals rows)
    group,              // currentGroup
    branchName,
    currentUser,
    currentDate,
    blockers: pageBlockers = {},   // { isFilterMode, isWeekend, isHoliday, branchLocked, groupClosed, prevDraft, hasUnsavedEdits, dayName }
    engineDeps,         // { getMinMcbu, isCsfCollectionAllowed, csfEnabled, hasGroupLeader, minCsfCollection }
    autoDownload = false,   // opened from the Groups page with ?downloadTemplate=1
}) => {
    const fileRef = useRef(null);
    const autoRan = useRef(false);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [reason, setReason] = useState('');
    const [replaceManual, setReplaceManual] = useState(false);

    // the template only offers remarks the upload can process
    const remarksOptions = useMemo(
        () => (mode === 'weekly' ? LOR_WEEKLY_REMARKS : LOR_DAILY_REMARKS).filter(o => !UPLOAD_BLOCKED_REMARKS.includes(o.value)),
        [mode]
    );

    const allowedRole = canUseOfflineUpload(currentUser);
    const blockers = getUploadBlockers({ allowedRole, mode, groupDay: group?.day, ...pageBlockers });
    const disabled = busy || blockers.length > 0;

    const handleDownload = async () => {
        if (blockers.length > 0) { toast.error(blockers[0]); return; }
        const { rows: uploadable, excluded } = selectUploadableRows(rows);
        if (uploadable.length === 0) {
            if (excluded.length > 0 && excluded.every(e => e.reason === 'Already submitted.')) {
                toast.info("This group's collection is already submitted for today.");
            } else {
                toast.warning('No rows of this group can be uploaded today.');
            }
            return;
        }

        setBusy(true);
        try {
            const buffer = await buildTemplate({
                rows: uploadable, group, branchName, loName: group?.loanOfficerName, mode, date: currentDate,
                remarksOptions, isCsfCollectionAllowed: engineDeps.isCsfCollectionAllowed,
                generatedBy: `${currentUser.firstName} ${currentUser.lastName}`,
            });
            triggerDownload(buffer, `LOR_${mode}_${group?.name || 'group'}_${currentDate}.xlsx`);
            toast.success(`Template downloaded: ${uploadable.length} row(s)${excluded.length ? `, ${excluded.length} left out (already submitted or must be processed online)` : ''}.`);
        } catch (error) {
            console.error('Template build failed:', error);
            toast.error('Could not build the template: ' + error.message);
        } finally {
            setBusy(false);
        }
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';                       // allow picking the same file again
        if (!file) return;
        if (blockers.length > 0) { toast.error(blockers[0]); return; }
        if (!/\.xlsx$/i.test(file.name)) { toast.error('Please choose the .xlsx template you downloaded.'); return; }

        setBusy(true);
        try {
            const buffer = await file.arrayBuffer();
            const fileHash = await sha256Hex(buffer);
            const parsed = await parseTemplate(buffer, {
                remarksOptions, expected: { groupId: group?._id, mode, date: currentDate },
            });

            if (parsed.errors.length > 0) {
                setPreview({ fileName: file.name, parseErrors: parsed.errors, results: [], summary: null });
                return;
            }

            // valid when downloaded, but is it still valid for the page as it is now?
            const stillValid = checkTemplateAgainstPage(parsed.items, rows);
            if (stillValid.errors.length > 0) {
                setPreview({ fileName: file.name, parseErrors: stillValid.errors, results: [], summary: null });
                return;
            }

            const engine = createRowEngine({ mode, safeNumber, ...engineDeps });
            const applied = applyTemplate({ items: parsed.items, pageRows: rows, engine, ccFieldsString: CASH_COLLECTIONS_FIELDS });
            const manualDrafts = selectUploadableRows(rows).rows.filter(r => r.draft && r.origin !== 'offline').length;

            setPreview({
                fileName: file.name, fileHash, meta: parsed.meta, parseErrors: [],
                results: applied.results, summary: applied.summary, commitRows: applied.commitRows, manualDrafts,
            });
        } catch (error) {
            console.error('Template read failed:', error);
            toast.error('Could not read the file: ' + error.message);
        } finally {
            setBusy(false);
        }
    };

    const handleCommit = async () => {
        if (!preview?.summary?.canCommit) return;
        if (reason.trim().length < 5) { toast.error('Please enter why this collection was done offline.'); return; }

        setBusy(true);
        try {
            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/offline-upload/commit', {
                groupId: group._id,
                rows: preview.commitRows,
                fileHash: preview.fileHash,
                fileName: preview.fileName,
                templateVersion: TEMPLATE_VERSION,
                templateDate: preview.meta.date,
                templateLoanIds: preview.meta.templateLoanIds,
                reason: reason.trim(),
                replaceManualDrafts: replaceManual,
            });

            if (response?.skipped?.length > 0) {
                setPreview(null);
                setReason('');
                setReplaceManual(false);
                setResult(response);                          // the user must read what was skipped
            } else if (response?.success) {
                setPreview(null);
                setReason('');
                setReplaceManual(false);
                toast.success(response.message);
                setTimeout(() => window.location.reload(), 1200);
            } else {
                toast.error(response?.message || 'The upload was not saved.', { autoClose: 8000 });
            }
        } catch (error) {
            console.error('Commit failed:', error);
            toast.error('The upload failed. Nothing was saved.');
        } finally {
            setBusy(false);
        }
    };

    // Groups page -> "download template" opens this page with ?downloadTemplate=1
    useEffect(() => {
        if (!autoDownload || autoRan.current || !allowedRole) return;
        if (!rows.some(r => r?.clientId)) return;              // wait until the rows are in
        autoRan.current = true;
        // strip the query without a router event, so the page does not reload its data
        window.history.replaceState(window.history.state, '', window.location.pathname);
        handleDownload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoDownload, rows.length, allowedRole]);

    if (!allowedRole) return null;

    const closePreview = () => { if (!busy) setPreview(null); };
    const closeResult = () => {
        const savedSomething = result?.appliedCount > 0;
        setResult(null);
        if (savedSomething) window.location.reload();
    };

    return (
        <React.Fragment>
            <div className="flex items-center gap-2">
                <button type="button" className={buttonClass} disabled={disabled} onClick={handleDownload}
                    title={blockers.length > 0 ? blockers.join('\n') : 'Download the offline collection template'}>
                    <Download className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Template</span>
                </button>
                <button type="button" className={buttonClass} disabled={disabled} onClick={() => fileRef.current?.click()}
                    title={blockers.length > 0 ? blockers.join('\n') : 'Upload a filled-in template'}>
                    <Upload className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Upload</span>
                </button>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
            </div>

            {/* preview: nothing has been saved at this point */}
            <Modal title="Upload offline collection" show={!!preview} onClose={closePreview} width="60rem">
                {preview && (
                    <div className="px-6 pb-6 text-sm text-gray-700">
                        <p className="mb-3 text-gray-500">File: {preview.fileName}</p>

                        {preview.parseErrors.length > 0 ? (
                            <React.Fragment>
                                <p className="mb-2 font-semibold text-red-600">The file cannot be used. Fix these and upload again:</p>
                                <ul className="list-disc pl-5 space-y-1 max-h-72 overflow-y-auto">
                                    {preview.parseErrors.map((er, i) => (
                                        <li key={i}>{er.slotNo ? `Slot ${er.slotNo}: ` : ''}{er.message}</li>
                                    ))}
                                </ul>
                                <div className="flex justify-end mt-4 w-40 ml-auto">
                                    <ButtonOutline label="Close" type="button" className="p-2" onClick={closePreview} />
                                </div>
                            </React.Fragment>
                        ) : (
                            <React.Fragment>
                                <p className="mb-2">
                                    {preview.summary.total} row(s) read.{' '}
                                    {preview.summary.failed > 0
                                        ? <span className="font-semibold text-red-600">{preview.summary.failed} row(s) have errors, so nothing can be saved. Fix the file and upload again.</span>
                                        : <span className="font-semibold text-green-700">All rows are valid.{preview.summary.withWarnings > 0 ? ` ${preview.summary.withWarnings} have warnings to check on the LOR page.` : ''}</span>}
                                </p>

                                <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-md">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                                            <tr>
                                                <th className="p-2">Slot</th>
                                                <th className="p-2 text-right">Payment</th>
                                                <th className="p-2 text-right">MCBU</th>
                                                <th className="p-2 text-right">Balance after</th>
                                                <th className="p-2">Remarks</th>
                                                <th className="p-2">Check</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.results.map((r, i) => (
                                                <tr key={r.loanId + i} className={`border-t border-gray-100 ${r.ok ? '' : 'bg-red-50'}`}>
                                                    <td className="p-2">{r.slotNo}</td>
                                                    <td className="p-2 text-right">{r.payment ?? '-'}</td>
                                                    <td className="p-2 text-right">{r.mcbuCol ?? '-'}</td>
                                                    <td className="p-2 text-right">{r.loanBalance ?? '-'}</td>
                                                    <td className="p-2">{r.remarks || '-'}</td>
                                                    <td className="p-2">
                                                        {r.errors.map((m, k) => <div key={'e' + k} className="text-red-600">{m}</div>)}
                                                        {r.warnings.map((m, k) => <div key={'w' + k} className="text-amber-600">{m}</div>)}
                                                        {r.ok && r.warnings.length === 0 && <span className="text-green-700">OK</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {preview.summary.canCommit && (
                                    <div className="mt-4 space-y-3">
                                        <div>
                                            <label className="block mb-1 font-medium">Why was this collection done offline?</label>
                                            <textarea rows="2" value={reason} onChange={(e) => setReason(e.target.value)}
                                                className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300"
                                                placeholder="e.g. No internet at the meeting place" />
                                        </div>
                                        {preview.manualDrafts > 0 && (
                                            <label className="flex items-center gap-2">
                                                <input type="checkbox" checked={replaceManual} onChange={(e) => setReplaceManual(e.target.checked)} />
                                                <span>Replace {preview.manualDrafts} draft(s) saved from the LOR page (otherwise those rows are skipped)</span>
                                            </label>
                                        )}
                                        <p className="text-gray-500">
                                            Rows are saved as drafts for today. Nothing is submitted until the collection is submitted on this page.
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 mt-4">
                                    <div className="w-40"><ButtonOutline label="Cancel" type="button" className="p-2" onClick={closePreview} disabled={busy} /></div>
                                    {preview.summary.canCommit && (
                                        <div className="w-40"><ButtonSolid label="Save as draft" type="button" onClick={handleCommit} disabled={busy} /></div>
                                    )}
                                </div>
                            </React.Fragment>
                        )}
                    </div>
                )}
            </Modal>

            {/* result: shown only when the server skipped some rows */}
            <Modal title={result?.appliedCount > 0 ? 'Upload saved' : 'Nothing was saved'} show={!!result} onClose={closeResult} width="40rem">
                {result && (
                    <div className="px-6 pb-6 text-sm text-gray-700">
                        <p className="mb-2 font-semibold">
                            {result.appliedCount > 0
                                ? `${result.appliedCount} row(s) saved as draft, ${result.skippedCount} skipped:`
                                : `All ${result.skippedCount} row(s) were skipped:`}
                        </p>
                        <ul className="list-disc pl-5 space-y-1 max-h-72 overflow-y-auto">
                            {result.skipped.map((s, i) => <li key={i}>Slot {s.slotNo}: {s.reason}</li>)}
                        </ul>
                        <div className="flex justify-end mt-4 w-40 ml-auto">
                            <ButtonSolid label="OK" type="button" onClick={closeResult} />
                        </div>
                    </div>
                )}
            </Modal>
        </React.Fragment>
    );
};

export default OfflineUploadControls;