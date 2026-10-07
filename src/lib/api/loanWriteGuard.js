// src/lib/api/loanWriteGuard.js
// Authorization + input hardening for the three endpoints that change a loan's
// state and until now trusted whatever the browser sent:
//
//   transactions/loans/approve-by-batch   LDF approve, final approval
//   transactions/loans/reject             reject (and, unused, approve)
//   transactions/loans/clear-guarantor-flag
//
// What those endpoints did before: no role check, no branch check, no pending
// check, and every LOAN_FIELDS column present in the request body was written to
// the loan (status, principal, amount release, ids ...), plus an SMS to whatever
// contact number the body carried.
//
// What the guard does:
//   1. caller must be an approver (branch manager / supervisor roles), or for the
//      guarantor flag the role that is meant to do that action
//   2. every loan must be a PENDING loan inside the caller's scope, read fresh
//      from the database (same SQL function and gates as the v2 page)
//   3. the same blockers as the v2 page apply (overdue release, group closed,
//      missing PN, ...), so a direct API call cannot do what the page refuses
//   4. the payload is REBUILT from the database row with the exact builders the
//      page uses (lib/loan-approval-client.js). The browser contributes the loan
//      ids, the reject reason and the disbursement photo key — nothing else. As a
//      side effect a stale page can no longer overwrite edits made after it
//      loaded.
//
// LOAN_WRITE_GUARD_MODE (server env var):
//   off      guard does nothing
//   log      (default) evaluates everything and logs what it WOULD deny or
//            change, but lets the request through untouched. Run this first: it
//            shows any caller you did not know about before anything is refused.
//   enforce  denies and rebuilds as described above
//
// Denials use each endpoint's own error shape so the classic page still shows
// them: approve-by-batch -> { success, withError, errorMsg[] }, reject ->
// { error, message }, guarantor flag -> { success: false, message }.

import logger from '@/logger';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';
import { approvalMode } from '@/lib/loan-application-v2-gate';
import {
    collectBlockers,
    computeGates,
    finalApprovalBlockers,
    getManilaToday,
    loadApprovalRows,
    requireApprover,
} from '@/lib/api/loanApprovalGates';
import {
    buildApplicationPayload,
    buildDisbursementPayload,
    buildLdfPayload,
    buildRejectPayload,
    mapApprovalRow,
} from '@/lib/loan-approval-client';

const graph = new GraphProvider();
const LOAN_BRIEF = createGraphType('loans', '_id branchId loId status');

const MODES = ['off', 'log', 'enforce'];
export const LOAN_WRITE_GUARD_MODE = MODES.includes(process.env.LOAN_WRITE_GUARD_MODE)
    ? process.env.LOAN_WRITE_GUARD_MODE
    : 'log';

const MAX_LOANS = 500;
const APPROVAL_ORIGINS = ['ldf', 'application', 'duplicate'];

// Fields whose value in the request is compared with the database, to spot a
// tampered or stale payload. Only the FIELD NAMES are ever logged.
const COMPARED_FIELDS = [
    'clientId', 'groupId', 'branchId', 'loId', 'principalLoan', 'amountRelease',
    'loanCycle', 'pnNumber', 'dateOfRelease', 'contactNumber',
];
const NUMERIC_FIELDS = new Set(['principalLoan', 'amountRelease', 'loanCycle']);

const isAdminLevel = (user) => user?.root === true || user?.role?.rep === 1;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

function changedFields(sent, row) {
    const out = [];
    COMPARED_FIELDS.forEach((f) => {
        if (sent?.[f] === undefined) return;
        const same = NUMERIC_FIELDS.has(f)
            ? Number(sent[f]) === Number(row?.[f])
            : String(sent[f] ?? '') === String(row?.[f] ?? '');
        if (!same) out.push(f);
    });
    return out;
}

function logOutcome(endpoint, req, { denied, changed, extra }) {
    if (denied.length === 0 && changed.length === 0) return;
    logger.warn({
        page: 'Loan write guard',
        endpoint,
        mode: LOAN_WRITE_GUARD_MODE,
        userId: req?.auth?.sub,
        wouldDeny: denied,
        sentValuesDifferFromDatabase: changed, // [{ loanId, fields }]
        ...extra,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// approve-by-batch
// ─────────────────────────────────────────────────────────────────────────────
async function evaluateApproval(req, { loanData, origin, skippedClientIds }) {
    const denied = [];
    const changed = [];

    if (!APPROVAL_ORIGINS.includes(origin)) {
        return { denied: [`Unknown approval type "${origin}".`], changed, rebuilt: null };
    }
    if (!Array.isArray(loanData) || loanData.length === 0) {
        return { denied: ['No loans were sent.'], changed, rebuilt: null };
    }
    if (loanData.length > MAX_LOANS) {
        return { denied: [`Select at most ${MAX_LOANS} loans at a time.`], changed, rebuilt: null };
    }
    const ids = loanData.map((l) => l?._id);
    if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
        return { denied: ['Every loan needs a unique id.'], changed, rebuilt: null };
    }

    const caller = await requireApprover(req);
    if (caller.error) return { denied: [caller.error], changed, rebuilt: null };
    const { user, mode, scope } = caller;

    if (origin === 'duplicate' && !isAdminLevel(user)) {
        return { denied: ['Only an administrator can approve duplicate-client loans.'], changed, rebuilt: null };
    }

    const today = await getManilaToday();
    const loaded = await loadApprovalRows(ids, { scope, currentDate: today, fresh: true });
    if (loaded.error) return { denied: [loaded.error], changed, rebuilt: null };

    const isFinal = origin !== 'ldf';
    const sentById = new Map(loanData.map((l) => [l._id, l]));
    const rows = [];
    const gates = {};
    const photoKeys = {};

    ids.forEach((id) => {
        const row = loaded.rowById.get(id);
        if (!row) {
            denied.push(`Loan ${id} is no longer pending or is outside your branches.`);
            return;
        }
        const sent = sentById.get(id);
        const g = computeGates(row);
        const branch = loaded.branchById.get(loaded.branchOfLoan.get(id));

        let blockers = collectBlockers(row, g, { today });
        if (isFinal) blockers = blockers.concat(finalApprovalBlockers(row, branch, mode));
        if (origin === 'duplicate') blockers = blockers.filter((b) => b.code !== 'DUPLICATE_CLIENT');

        // A branch on the v2 flow must come with its disbursement photo.
        const photoKey = text(sent.disbursementPhotoKey);
        if (photoKey.length > 512) {
            denied.push(`Loan ${id}: the disbursement photo reference is invalid.`);
        }
        const v2 = branch?.clientFlowVersion === 'v2';
        if (isFinal && mode === 'branch_manager' && v2 && !photoKey) {
            const c = row.client ?? {};
            blockers.push({
                message: `${`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()} in group ${row.group?.name ?? ''}: a disbursement photo is required on this branch.`,
            });
        }

        blockers.forEach((b) => denied.push(b.message));

        const diff = changedFields(sent, row);
        if (diff.length > 0) changed.push({ loanId: id, fields: diff });

        rows.push(row);
        gates[id] = g;
        photoKeys[id] = { key: photoKey, v2 };
    });

    if (denied.length > 0) {
        return { denied: Array.from(new Set(denied)), changed, rebuilt: null };
    }

    // Rebuild from the database with the page's own builders.
    const mapped = rows.map((row) => mapApprovalRow(row, gates[row._id]));
    let rebuilt;
    if (origin === 'ldf') {
        rebuilt = buildLdfPayload(mapped, today);
    } else {
        const approverId = req.auth.sub;
        const sentApprover = rows.map((r) => sentById.get(r._id).ldfApprovedBy).find(Boolean);
        if (sentApprover && sentApprover !== approverId) {
            // "Approved by" is the signed-in user, not something the browser picks.
            changed.push({ loanId: '*', fields: ['ldfApprovedBy'] });
        }
        const photoLoans = mapped.filter((m) => photoKeys[m._id].key || photoKeys[m._id].v2);
        const plainLoans = mapped.filter((m) => !(photoKeys[m._id].key || photoKeys[m._id].v2));
        const withPhoto = buildDisbursementPayload(photoLoans, { disbursementPhotoKey: null, approverId })
            .map((l) => ({ ...l, disbursementPhotoKey: photoKeys[l._id].key }));
        rebuilt = [...withPhoto, ...buildApplicationPayload(plainLoans, today)];
        // keep the order the user selected them in
        const order = new Map(ids.map((id, i) => [id, i]));
        rebuilt.sort((a, b) => order.get(a._id) - order.get(b._id));
    }

    const clientIds = new Set(rows.map((r) => r.clientId));
    const skipped = (Array.isArray(skippedClientIds) ? skippedClientIds : []).filter((c) => clientIds.has(c));

    return { denied, changed, rebuilt, skipped };
}

export async function guardApproval(req, { loanData, origin, skippedClientIds = [] }) {
    if (LOAN_WRITE_GUARD_MODE === 'off') return { deny: false, loanData, skippedClientIds };

    let result;
    try {
        result = await evaluateApproval(req, { loanData, origin, skippedClientIds });
    } catch (e) {
        // A guard that cannot run must not take approvals down in log mode;
        // in enforce mode it fails closed.
        logger.error({ page: 'Loan write guard', endpoint: 'approve-by-batch', error: e.message });
        if (LOAN_WRITE_GUARD_MODE === 'enforce') {
            return {
                deny: true,
                response: { success: true, withError: true, errorMsg: ['Approval could not be verified. Please try again.'] },
            };
        }
        return { deny: false, loanData, skippedClientIds };
    }

    logOutcome('approve-by-batch', req, { denied: result.denied, changed: result.changed, extra: { origin, loans: Array.isArray(loanData) ? loanData.length : 0 } });

    if (LOAN_WRITE_GUARD_MODE === 'log') return { deny: false, loanData, skippedClientIds };

    if (result.denied.length > 0) {
        return { deny: true, response: { success: true, withError: true, errorMsg: result.denied } };
    }
    return { deny: false, loanData: result.rebuilt, skippedClientIds: result.skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// reject
// ─────────────────────────────────────────────────────────────────────────────
async function evaluateReject(req) {
    const body = req.body ?? {};
    const changed = [];

    if (typeof body._id !== 'string' || !body._id) return { denied: ['loan id is required.'], changed };
    if (body.status !== 'reject') {
        return { denied: ['This endpoint only rejects loans. Approvals go through the approval screen.'], changed };
    }
    const reason = text(body.rejectReason);
    if (!reason) return { denied: ['Reject reason is required!'], changed };
    if (reason.length > 500) return { denied: ['Reject reason is too long.'], changed };

    const caller = await requireApprover(req);
    if (caller.error) return { denied: [caller.error], changed };
    if (caller.mode !== 'branch_manager') {
        return { denied: ['Only branch managers can reject loans.'], changed };
    }

    const today = await getManilaToday();
    const loaded = await loadApprovalRows([body._id], { scope: caller.scope, currentDate: today, fresh: true });
    if (loaded.error) return { denied: [loaded.error], changed };

    const row = loaded.rowById.get(body._id);
    if (!row) return { denied: ['This loan is no longer pending or is outside your branch.'], changed };

    const gates = computeGates(row);
    if (gates.transactionClosed) {
        return { denied: ['Group transaction is already closed for the day.'], changed };
    }

    const diff = changedFields(body, row);
    if (diff.length > 0) changed.push({ loanId: body._id, fields: diff });

    const rebuilt = buildRejectPayload(mapApprovalRow(row, gates), {
        userId: req.auth.sub,
        currentDate: today,
        reason,
    });
    return { denied: [], changed, rebuilt };
}

export async function guardReject(req) {
    if (LOAN_WRITE_GUARD_MODE === 'off') return { deny: false, loan: req.body };

    let result;
    try {
        result = await evaluateReject(req);
    } catch (e) {
        logger.error({ page: 'Loan write guard', endpoint: 'reject', error: e.message });
        if (LOAN_WRITE_GUARD_MODE === 'enforce') {
            return { deny: true, response: { error: true, message: 'Reject could not be verified. Please try again.' } };
        }
        return { deny: false, loan: req.body };
    }

    logOutcome('reject', req, { denied: result.denied, changed: result.changed, extra: { loanId: req.body?._id } });

    if (LOAN_WRITE_GUARD_MODE === 'log') return { deny: false, loan: req.body };
    if (result.denied.length > 0) {
        return { deny: true, response: { error: true, message: result.denied[0] } };
    }
    return { deny: false, loan: result.rebuilt };
}

// ─────────────────────────────────────────────────────────────────────────────
// clear-guarantor-flag
//   flag   — raised by the add / edit save when a duplicate guarantor is
//            detected: the loan officer who owns the loan, their branch manager,
//            or a supervisor
//   clear  — supervisors / admin only (the review decision)
//   reject — supervisors / admin only, and only for a PENDING loan
// ─────────────────────────────────────────────────────────────────────────────
async function evaluateGuarantorFlag(req, { loanId, action }) {
    const user = await findUserById(req.auth.sub);
    if (!user) return ['User not found.'];

    const rep = user.role?.rep;
    const supervisor = approvalMode(user) === 'supervisor';
    const branchManager = rep === 3;
    const loanOfficer = rep === 4;

    if (action === 'flag') {
        if (!supervisor && !branchManager && !loanOfficer) return ['You do not have permission to flag this loan.'];
    } else if (!supervisor) {
        return ['Only an administrator or supervisor can review a guarantor flag.'];
    }

    const scope = await resolveLoanBranchScope(user);
    if (scope.branchIds && scope.branchIds.length === 0) return ['No branches are assigned to your account.'];

    const and = [{ _id: { _eq: loanId } }];
    if (scope.branchIds) and.push({ branchId: { _in: scope.branchIds } });
    if (action === 'flag' && loanOfficer) and.push({ loId: { _eq: user._id } });

    const [loan] = await graph
        .query(queryQl(LOAN_BRIEF('found'), { where: { _and: and }, limit: 1 }))
        .then((r) => r.data?.found ?? []);

    if (!loan) return ['Loan not found.'];
    if (action === 'reject' && loan.status !== 'pending') return ['Only a pending loan can be rejected here.'];
    return [];
}

export async function guardGuarantorFlag(req, { loanId, action }) {
    if (LOAN_WRITE_GUARD_MODE === 'off') return { deny: false };

    let denied;
    try {
        denied = await evaluateGuarantorFlag(req, { loanId, action });
    } catch (e) {
        logger.error({ page: 'Loan write guard', endpoint: 'clear-guarantor-flag', error: e.message });
        if (LOAN_WRITE_GUARD_MODE === 'enforce') {
            return { deny: true, response: { success: false, message: 'Could not verify this request. Please try again.' } };
        }
        return { deny: false };
    }

    logOutcome('clear-guarantor-flag', req, { denied, changed: [], extra: { loanId, action } });

    if (LOAN_WRITE_GUARD_MODE === 'log' || denied.length === 0) return { deny: false };
    return { deny: true, response: { success: false, message: denied[0] } };
}