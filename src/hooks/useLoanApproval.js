// src/hooks/useLoanApproval.js
// Approval actions for the v2 Loan Application page, for two modes:
//
//   'branch_manager'  own branch. LDF approve, Approve loans (v2 branches go
//                     through DisbursementPhotoModal first), Reject, Details.
//   'supervisor'      admin / deputy_director / regional_manager / area_admin,
//                     across their branches. LDF approve, Approve loans (never
//                     through the photo modal: loans on v2 branches are blocked
//                     for supervisors by the server), Details. No Reject.
//
//   LDF approve   tab 'ldf'          -> approve-by-batch, origin 'ldf'
//   Approve loans tab 'application'  -> approve-by-batch, origin 'application'
//   Reject        any pending tab    -> loans/reject, status 'reject' + reason
//   Details       any pending tab    -> LDFApprovalDetailsModal
//
// The WRITES go to the same endpoints with the same payloads as the classic page
// (see lib/loan-approval-client.js). What changes is where the inputs come from:
//   - gate flags + blockers come from the server (approval-context / approval-rows)
//   - at action time the rows are re-read fresh (approval-rows), and the action
//     is aborted if anything selected is now blocked or no longer pending
//
// Selection is cleared whenever the tab or any filter changes (resetKey), so a
// loan the user can no longer see can never be approved by accident.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import {
    buildApplicationPayload,
    buildDisbursementPayload,
    buildLdfPayload,
    buildRejectPayload,
    collectMissingInfo,
    mapApprovalRow,
} from '@/lib/loan-approval-client';

const api = (path) => `${getApiBaseUrl()}transactions/loans/${path}`;
const REFRESH_DELAY_MS = 1000; // same cushion the classic page waited before reloading

export function useLoanApproval({
    enabled,
    mode,
    tab,
    loans,
    resetKey,
    currentUser,
    currentBranch,
    currentDate,
    fetchAllIds,
    onChanged,
}) {
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [rawContext, setRawContext] = useState({});
    const [busy, setBusy] = useState(null); // 'ldf' | 'application' | 'reject' | 'select-all' | 'details' | null
    const [blockersDialog, setBlockersDialog] = useState(null); // string[] | null
    const [disbursementRows, setDisbursementRows] = useState(null); // mapped rows | null
    const [rejectTarget, setRejectTarget] = useState(null); // list loan | null
    const [detailsRow, setDetailsRow] = useState(null);
    // Print LDF: rows handed to LDFListPage, and a counter the page watches so it
    // knows when a fresh set is ready to print.
    const [ldfPrintRows, setLdfPrintRows] = useState(null);
    const [ldfPrintSeq, setLdfPrintSeq] = useState(0);

    const ctxSeq = useRef(0);

    // ── Gate context for what is on screen ───────────────────────────────
    const pageIds = useMemo(() => (loans ?? []).map((l) => l._id), [loans]);
    const pageKey = pageIds.join(',');

    // Returns the context map, or null after remembering why in lastContextError.
    const lastContextError = useRef(null);
    const loadContext = useCallback(async (ids) => {
        if (!ids.length) return {};
        const res = await fetchWrapper.post(api('approval-context'), { loanIds: ids });
        if (res.success) { lastContextError.current = null; return res.context ?? {}; }
        lastContextError.current = res.message || null;
        return null;
    }, []);

    // Final approval ('application' tab) has extra blockers for supervisors
    // (branch needs a disbursement photo, branch locked). Fold them in so the
    // checkbox, the pills and "select all" all follow the tab the user is on.
    const context = useMemo(() => {
        const out = {};
        Object.entries(rawContext).forEach(([id, c]) => {
            out[id] = {
                ...c,
                blockers: tab === 'application' ? [...c.blockers, ...(c.finalBlockers ?? [])] : c.blockers,
            };
        });
        return out;
    }, [rawContext, tab]);

    useEffect(() => {
        if (!enabled || pageIds.length === 0) return undefined;
        const seq = ++ctxSeq.current;
        loadContext(pageIds).then((ctx) => {
            if (seq !== ctxSeq.current || !ctx) return;
            setRawContext((prev) => ({ ...prev, ...ctx }));
        }).catch((e) => console.error('[useLoanApproval] context failed', e));
        return () => { ctxSeq.current += 1; };
        // pageKey is the stable identity of pageIds
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, pageKey, loadContext]);

    useEffect(() => { setSelectedIds(new Set()); }, [resetKey]);

    const isEligible = useCallback((id) => {
        const ctx = context[id];
        return !!ctx && ctx.blockers.length === 0;
    }, [context]);

    // ── Selection ────────────────────────────────────────────────────────
    const toggle = useCallback((id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else if (isEligible(id)) next.add(id);
            return next;
        });
    }, [isEligible]);

    const eligiblePageIds = useMemo(() => pageIds.filter(isEligible), [pageIds, isEligible]);
    const allPageSelected = eligiblePageIds.length > 0 && eligiblePageIds.every((id) => selectedIds.has(id));
    const somePageSelected = eligiblePageIds.some((id) => selectedIds.has(id));

    const togglePage = useCallback(() => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allPageSelected) eligiblePageIds.forEach((id) => next.delete(id));
            else eligiblePageIds.forEach((id) => next.add(id));
            return next;
        });
    }, [allPageSelected, eligiblePageIds]);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    // Every loan matching the tab + filters (not just this page), eligible ones only.
    const selectAllMatching = useCallback(async () => {
        if (busy) return;
        setBusy('select-all');
        try {
            const { ids, capped, cap } = await fetchAllIds();
            if (ids.length === 0) { toast.info('Nothing to select.'); return; }
            const ctx = await loadContext(ids);
            if (!ctx) {
                toast.error(lastContextError.current || 'Unable to check which loans can be approved.');
                return;
            }
            setRawContext((prev) => ({ ...prev, ...ctx }));
            const eligible = ids.filter((id) => {
                const c = ctx[id];
                if (!c) return false;
                const extra = tab === 'application' ? (c.finalBlockers ?? []) : [];
                return c.blockers.length === 0 && extra.length === 0;
            });
            setSelectedIds(new Set(eligible));
            const blocked = ids.length - eligible.length;
            toast.success(
                `Selected ${eligible.length} loan${eligible.length === 1 ? '' : 's'}` +
                (blocked > 0 ? `; ${blocked} skipped because they are blocked.` : '.') +
                (capped ? ` Only the first ${cap} were checked.` : '')
            );
        } catch (e) {
            console.error('[useLoanApproval] select all failed', e);
            toast.error('Unable to select loans.');
        } finally {
            setBusy(null);
        }
    }, [busy, fetchAllIds, loadContext, tab]);

    // ── Fresh rows for a write ───────────────────────────────────────────
    // Returns { rows } (mapped, classic shape) or null after surfacing why not.
    const loadFreshRows = useCallback(async (ids, origin) => {
        const res = await fetchWrapper.post(api('approval-rows'), { loanIds: ids, origin });
        if (!res.success) {
            toast.error(res.message || 'Unable to load the selected loans.');
            return null;
        }
        if (res.missing?.length > 0) {
            toast.error(
                `${res.missing.length} selected loan${res.missing.length === 1 ? ' is' : 's are'} no longer pending. The list will refresh.`
            );
            onChanged?.();
            return null;
        }
        const blocked = [];
        res.rows.forEach((row) => {
            (res.blockers[row._id] ?? []).forEach((b) => blocked.push(b.message));
        });
        if (blocked.length > 0) {
            setBlockersDialog(Array.from(new Set(blocked)));
            return null;
        }
        return { rows: res.rows.map((row) => mapApprovalRow(row, res.gates[row._id])) };
    }, [onChanged]);

    const finishWrite = useCallback((response, { okMessage }) => {
        if (response?.success) {
            if (response.withError) {
                toast.error((response.errorMsg ?? []).join('\n') || 'Some loans could not be updated.');
            } else {
                toast.success(okMessage);
            }
            if (response.skippedFaceVerification?.length > 0) {
                const names = response.skippedFaceVerification.map((s) => s.clientName || s.clientId).join(', ');
                toast.warning(
                    `Face verification was skipped for: ${names} (legacy client, no new-flow record).`,
                    { autoClose: 8000 }
                );
            }
            setSelectedIds(new Set());
            setTimeout(() => onChanged?.(), REFRESH_DELAY_MS);
        } else {
            toast.error(response?.message || 'The update failed. Nothing was changed on screen; please refresh and check.');
        }
    }, [onChanged]);

    // ── LDF approve ──────────────────────────────────────────────────────
    const ldfApprove = useCallback(async () => {
        if (busy) return;
        const ids = [...selectedIds];
        if (ids.length === 0) { toast.error('No loan selected!'); return; }
        setBusy('ldf');
        try {
            const fresh = await loadFreshRows(ids, 'ldf');
            if (!fresh) return;

            const problems = collectMissingInfo(fresh.rows);
            if (problems.length > 0) {
                toast.error(`${problems.join('\n')}\n\nPlease update each missing info before approving.`, { autoClose: 5000 });
                return;
            }

            const response = await fetchWrapper.post(api('approve-by-batch'), {
                loanData: buildLdfPayload(fresh.rows, currentDate),
                origin: 'ldf',
                user: currentUser,
            });
            finishWrite(response, { okMessage: 'Selected loans successfully updated' });
        } catch (e) {
            console.error('[useLoanApproval] LDF approve failed', e);
            toast.error('LDF approval failed. Please refresh and check the list.');
        } finally {
            setBusy(null);
        }
    }, [busy, selectedIds, loadFreshRows, currentDate, currentUser, finishWrite]);

    // ── Approve loans ────────────────────────────────────────────────────
    const approveLoans = useCallback(async () => {
        if (busy) return;
        const ids = [...selectedIds];
        if (ids.length === 0) { toast.error('No loan selected!'); return; }
        setBusy('application');
        try {
            const fresh = await loadFreshRows(ids, 'application');
            if (!fresh) return;

            // A branch manager on a v2 branch captures the disbursement photo
            // first; the modal calls confirmDisbursement() below. (Classic skipped
            // the name/photo check on this path, so it is skipped here too.)
            // Supervisors never get here for a v2 branch: the server blocks those
            // loans, so everything left takes the direct path below.
            if (mode === 'branch_manager' && currentBranch?.clientFlowVersion === 'v2') {
                setDisbursementRows(fresh.rows);
                return;
            }

            const problems = collectMissingInfo(fresh.rows);
            if (problems.length > 0) {
                toast.error(`${problems.join('\n')}\n\nPlease update each missing info before approving.`, { autoClose: 5000 });
                return;
            }

            const response = await fetchWrapper.post(api('approve-by-batch'), {
                loanData: buildApplicationPayload(fresh.rows, currentDate),
                origin: 'application',
                user: currentUser,
            });
            finishWrite(response, { okMessage: 'Selected loans successfully approved.' });
        } catch (e) {
            console.error('[useLoanApproval] approve failed', e);
            toast.error('Approval failed. Please refresh and check the list.');
        } finally {
            setBusy(null);
        }
    }, [busy, selectedIds, loadFreshRows, mode, currentBranch, currentDate, currentUser, finishWrite]);

    const cancelDisbursement = useCallback(() => setDisbursementRows(null), []);

    // DisbursementPhotoModal -> onConfirm(disbursementPhotoKey, approverId, skippedClientIds)
    const confirmDisbursement = useCallback(async (disbursementPhotoKey, approverId, skippedClientIds = []) => {
        const rows = disbursementRows;
        setDisbursementRows(null);
        if (!rows) return;
        setBusy('application');
        try {
            const response = await fetchWrapper.post(api('approve-by-batch'), {
                loanData: buildDisbursementPayload(rows, { disbursementPhotoKey, approverId }),
                origin: 'application',
                user: currentUser,
                skippedClientIds,
            });
            finishWrite(response, { okMessage: 'Selected loans successfully updated' });
        } catch (e) {
            console.error('[useLoanApproval] disbursement approve failed', e);
            toast.error('Approval failed. Please refresh and check the list.');
        } finally {
            setBusy(null);
        }
    }, [disbursementRows, currentUser, finishWrite]);

    // ── Reject ───────────────────────────────────────────────────────────
    const openReject = useCallback((loan) => {
        if (context[loan._id]?.transactionClosed) {
            toast.error('Group transaction is already closed for the day.');
            return;
        }
        setRejectTarget(loan);
    }, [context]);

    const closeReject = useCallback(() => setRejectTarget(null), []);

    const confirmReject = useCallback(async (reason) => {
        const target = rejectTarget;
        const text = (reason ?? '').trim();
        if (!target) return;
        if (!text) { toast.error('Reject reason is required!'); return; }
        setBusy('reject');
        try {
            const res = await fetchWrapper.post(api('approval-rows'), { loanIds: [target._id] });
            if (!res.success) { toast.error(res.message || 'Unable to load the loan.'); return; }
            const row = res.rows?.[0];
            if (!row) {
                toast.error('This loan is no longer pending. The list will refresh.');
                setRejectTarget(null);
                onChanged?.();
                return;
            }
            if (res.gates[row._id]?.transactionClosed) {
                toast.error('Group transaction is already closed for the day.');
                setRejectTarget(null);
                return;
            }

            const mapped = mapApprovalRow(row, res.gates[row._id]);
            const response = await fetchWrapper.post(api('reject'), buildRejectPayload(mapped, {
                userId: currentUser._id,
                currentDate,
                reason: text,
            }));

            if (response.success) {
                toast.success('Loan successfully updated.');
                setRejectTarget(null);
                setSelectedIds((prev) => { const n = new Set(prev); n.delete(target._id); return n; });
                setTimeout(() => onChanged?.(), REFRESH_DELAY_MS);
            } else {
                toast.error(response.message || 'The loan could not be rejected.');
            }
        } catch (e) {
            console.error('[useLoanApproval] reject failed', e);
            toast.error('Reject failed. Please refresh and check the list.');
        } finally {
            setBusy(null);
        }
    }, [rejectTarget, currentUser, currentDate, onChanged]);

    // ── Print LDF (branch managers, tab 'ldf') ───────────────────────────
    // Classic printed the selected rows, or every row in the list when nothing was
    // selected. Same here, with one deliberate difference: loans that cannot be
    // approved (overdue release date, group closed, missing PN ...) are left off
    // the sheet, because the sheet is what the release is run from. The count that
    // was left off is reported. Rows are read-only (detailsOnly) and re-read fresh.
    const prepareLdfPrint = useCallback(async () => {
        if (busy) return;
        setBusy('print');
        try {
            let ids;
            if (selectedIds.size > 0) {
                ids = [...selectedIds];
            } else {
                const all = await fetchAllIds();
                if (all.ids.length === 0) { toast.info('There are no loans to print.'); return; }
                const ctx = await loadContext(all.ids);
                if (!ctx) {
                    toast.error(lastContextError.current || 'Unable to check which loans can be printed.');
                    return;
                }
                setRawContext((prev) => ({ ...prev, ...ctx }));
                ids = all.ids.filter((id) => ctx[id] && ctx[id].blockers.length === 0);
                const left = all.ids.length - ids.length;
                if (left > 0) {
                    toast.info(`${left} loan${left === 1 ? ' was' : 's were'} left off the sheet because ${left === 1 ? 'it' : 'they'} cannot be approved.`);
                }
                if (all.capped) toast.warning(`Only the first ${all.cap} loans were checked.`);
            }
            if (ids.length === 0) { toast.warning('No loans can be printed with the current filters.'); return; }

            const res = await fetchWrapper.post(api('approval-rows'), { loanIds: ids, origin: 'ldf', detailsOnly: true });
            if (!res.success) { toast.error(res.message || 'Unable to load the loans to print.'); return; }
            if (res.missing?.length > 0) {
                toast.warning(`${res.missing.length} loan${res.missing.length === 1 ? ' is' : 's are'} no longer pending and ${res.missing.length === 1 ? 'was' : 'were'} left off.`);
            }
            if (res.rows.length === 0) { toast.warning('Nothing left to print.'); return; }

            setLdfPrintRows(res.rows.map((row) => mapApprovalRow(row, res.gates[row._id])));
            setLdfPrintSeq((n) => n + 1);
        } catch (e) {
            console.error('[useLoanApproval] print LDF failed', e);
            toast.error('Unable to prepare the LDF for printing.');
        } finally {
            setBusy(null);
        }
    }, [busy, selectedIds, fetchAllIds, loadContext]);

    // ── Approval details (read-only) ─────────────────────────────────────
    const showDetails = useCallback(async (loan) => {
        if (busy) return;
        setBusy('details');
        try {
            const res = await fetchWrapper.post(api('approval-rows'), { loanIds: [loan._id], detailsOnly: true });
            const row = res.success ? res.rows?.[0] : null;
            if (!row) {
                toast.error(res.message || 'Approval details are only available for pending loans.');
                return;
            }
            setDetailsRow(mapApprovalRow(row, res.gates[row._id]));
        } catch (e) {
            console.error('[useLoanApproval] details failed', e);
            toast.error('Unable to load approval details.');
        } finally {
            setBusy(null);
        }
    }, [busy]);

    const closeDetails = useCallback(() => setDetailsRow(null), []);

    return {
        // data
        context, busy, selectedIds,
        selectedCount: selectedIds.size,
        eligiblePageCount: eligiblePageIds.length,
        allPageSelected, somePageSelected,
        // selection
        toggle, togglePage, clearSelection, selectAllMatching,
        // actions
        ldfApprove, approveLoans, openReject, showDetails,
        // dialogs
        blockersDialog, closeBlockers: () => setBlockersDialog(null),
        disbursementRows, confirmDisbursement, cancelDisbursement,
        rejectTarget, closeReject, confirmReject,
        detailsRow, closeDetails,
        // print LDF
        prepareLdfPrint, ldfPrintRows, ldfPrintSeq,
    };
}