// src/lib/support-analyze.js  (pure)
// Analyze one transaction (a cashCollections row) against its loan, group and client.
// The GROUP is the source of truth for branch / group / loan officer. Nothing here writes anything:
// issues that have an `expected` value and `repairable: true` can be handed to the normal editor (Repair).
import { computeLoanReconciliation } from './support-loan-reconcile';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const has = (v) => v !== null && v !== undefined && v !== '';
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const day = (d) => (d ? String(d).slice(0, 10) : null);

/**
 * @param {{ row?:object, prevRow?:object|null, loan:object, group?:object|null, client?:object|null,
 *           rows?:object[], today:string }} input   rows = every row of the loan, newest first (only used when row is the latest)
 */
export function analyzeTransaction({ row = null, prevRow = null, loan, group = null, client = null, rows = [], today }) {
    const issues = [];
    const add = (i) => issues.push({ severity: 'warning', repairable: false, ...i });
    const idMismatch = (entity, rec, field, expected, label, why) => {
        if (has(expected) && String(rec[field] ?? '') !== String(expected)) {
            add({ entity, id: rec._id, field, severity: 'error', current: rec[field] ?? null, expected, repairable: true, message: `${label} does not match ${why}.` });
        }
    };

    // ── group ────────────────────────────────────────────────────────────────
    if (!group) add({ entity: 'loans', id: loan._id, field: 'groupId', severity: 'error', current: loan.groupId ?? null, expected: null, message: 'The loan\'s group could not be found.' });

    // ── loan ─────────────────────────────────────────────────────────────────
    if (group) {
        idMismatch('loans', loan, 'groupId', group._id, 'Loan group', 'its group');
        idMismatch('loans', loan, 'branchId', group.branchId, 'Loan branch', 'the group\'s branch');
        idMismatch('loans', loan, 'loId', group.loanOfficerId, 'Loan officer', 'the group\'s loan officer');
    }
    if (client) {
        if (client._id !== loan.clientId) add({ entity: 'loans', id: loan._id, field: 'clientId', severity: 'error', current: loan.clientId, expected: client._id, message: 'Loan belongs to a different client.' });
        if (has(loan.fullName) && has(client.fullName) && norm(loan.fullName) !== norm(client.fullName)) {
            add({ entity: 'loans', id: loan._id, field: 'fullName', current: loan.fullName, expected: client.fullName, message: 'Loan name differs from the client name.' });
        }
    }
    for (const f of ['loanBalance', 'mcbu', 'csf', 'activeLoan', 'amountRelease']) {
        if (has(loan[f]) && num(loan[f]) < 0) add({ entity: 'loans', id: loan._id, field: f, severity: 'error', current: loan[f], expected: null, message: `${f} is negative.` });
    }
    if (num(loan.principalLoan) > 0 && num(loan.principalLoan) % 1000 !== 0) {
        add({ entity: 'loans', id: loan._id, field: 'principalLoan', current: loan.principalLoan, expected: null, message: 'Principal is not a multiple of 1,000.' });
    }
    const terms = num(loan.loanTerms);
    if (terms > 0 && num(loan.amountRelease) > 0 && Math.abs(num(loan.activeLoan) - num(loan.amountRelease) / terms) > 1 && num(loan.activeLoan) > 0 && loan.status === 'active') {
        add({ entity: 'loans', id: loan._id, field: 'activeLoan', current: loan.activeLoan, expected: r2(num(loan.amountRelease) / terms), repairable: true,
            message: `Per-installment amount should be amount to release ÷ terms (${loan.amountRelease} ÷ ${terms}).` });
    }
    if (loan.status === 'completed') {
        if (num(loan.loanBalance) > 0.005) add({ entity: 'loans', id: loan._id, field: 'loanBalance', severity: 'error', current: loan.loanBalance, expected: 0, repairable: true, message: 'Completed loan still has a balance.' });
        if (!has(loan.fullPaymentDate)) add({ entity: 'loans', id: loan._id, field: 'fullPaymentDate', severity: 'error', current: null, expected: null, message: 'Completed loan has no full payment date.' });
    } else if (loan.status === 'active' && has(loan.loanBalance) && num(loan.loanBalance) <= 0.005 && num(loan.amountRelease) > 0) {
        add({ entity: 'loans', id: loan._id, field: 'status', current: loan.status, expected: 'completed', message: 'Active loan has a zero balance — it may need to be completed.' });
    }
    if (loan.maturedPD === true && !has(loan.maturedPDDate)) add({ entity: 'loans', id: loan._id, field: 'maturedPDDate', current: null, expected: null, message: 'Flagged matured past due without a date.' });

    // ── the transaction (cashCollections row) ────────────────────────────────
    if (row) {
        const rid = row._id;
        const bad = (field, expected, message, extra = {}) => add({ entity: 'cashCollections', id: rid, field, current: row[field] ?? null, expected, message, ...extra });

        if (row.loanId && row.loanId !== loan._id) bad('loanId', loan._id, 'Row points to a different loan.', { severity: 'error' });
        if (row.clientId !== loan.clientId) bad('clientId', loan.clientId, 'Row client differs from the loan\'s client.', { severity: 'error', repairable: true });
        if (group) {
            if (String(row.groupId ?? '') !== String(group._id)) bad('groupId', group._id, 'Row group differs from the loan\'s group.', { severity: 'error', repairable: true });
            if (String(row.branchId ?? '') !== String(group.branchId ?? '')) bad('branchId', group.branchId, 'Row branch differs from the group\'s branch.', { severity: 'error', repairable: true });
            if (has(group.loanOfficerId) && String(row.loId ?? '') !== String(group.loanOfficerId)) bad('loId', group.loanOfficerId, 'Row loan officer differs from the group\'s loan officer.', { severity: 'error', repairable: true });
        }
        if (has(loan.slotNo) && String(row.slotNo ?? '') !== String(loan.slotNo)) bad('slotNo', loan.slotNo, 'Row slot number differs from the loan.', { repairable: false });
        if (has(loan.loanCycle) && num(row.loanCycle) !== num(loan.loanCycle)) bad('loanCycle', loan.loanCycle, 'Row loan cycle differs from the loan.', { repairable: false });

        const saved = row.draft !== true;
        const target = num(row.targetCollection) || num(loan.activeLoan);
        if (saved && ['active', 'completed'].includes(row.status) && num(loan.activeLoan) > 0 && has(row.activeLoan) && Math.abs(num(row.activeLoan) - num(loan.activeLoan)) > 0.005) {
            bad('activeLoan', loan.activeLoan, 'Row per-installment amount differs from the loan.', { repairable: true });
        }
        const pay = num(row.paymentCollection);
        if (saved && target > 0 && pay > 0) {
            const payoff = num(prevRow?.loanBalance ?? loan.amountRelease);
            const multiple = Math.abs(pay / target - Math.round(pay / target)) < 0.0001;
            if (!multiple && Math.abs(pay - payoff) > 0.005) bad('paymentCollection', null, `Payment ${pay} is not a multiple of the per-installment amount ${target}.`, { severity: 'error' });
        }
        if (saved) {
            if (num(row.loanBalance) < 0) bad('loanBalance', null, 'Row balance is negative.', { severity: 'error' });
            if (prevRow && has(prevRow.loanBalance)) {
                const expected = r2(num(prevRow.loanBalance) - pay);
                if (Math.abs(num(row.loanBalance) - expected) > 1) {
                    bad('loanBalance', expected, `Balance does not follow the previous row (${day(prevRow.dateAdded)}: ${prevRow.loanBalance} − payment ${pay}). Advance payments or later edits can explain this — review before repairing.`, { repairable: true, review: true });
                }
            }
            if (row.status === 'completed' && !has(row.fullPaymentDate)) bad('fullPaymentDate', null, 'Completed row has no full payment date.', { severity: 'error' });
            if (row.status === 'completed' && num(row.loanBalance) > 0.005) bad('loanBalance', 0, 'Completed row still has a balance.', { severity: 'error', repairable: true });
        }
        if (row.draft === true && day(row.dateAdded) < today) bad('draft', false, 'Draft row from a past date was never finalized (drafts do not update the loan).', { severity: 'info' });
    }

    // ── client ───────────────────────────────────────────────────────────────
    if (client && group && ['active', 'pending'].includes(loan.status)) {
        idMismatch('client', client, 'groupId', group._id, 'Client group', 'the group of their loan');
        idMismatch('client', client, 'branchId', group.branchId, 'Client branch', 'the group\'s branch');
        idMismatch('client', client, 'loId', group.loanOfficerId, 'Client loan officer', 'the group\'s loan officer');
        if (loan.status === 'active' && client.status !== 'active') add({ entity: 'client', id: client._id, field: 'status', current: client.status, expected: 'active', repairable: true, message: 'Client has an active loan but is not marked active.' });
    }

    // ── loan vs collections (same logic as the "next step" panel) — only meaningful when the row is the loan's newest saved row ──
    const latestSaved = rows.find((r) => r.draft !== true && ['active', 'completed', 'closed'].includes(r.status));
    if (!row || (latestSaved && row._id === latestSaved._id)) {
        for (const it of computeLoanReconciliation(loan, rows).items) {
            add({ entity: 'loans', id: loan._id, field: it.field, current: it.current, expected: it.suggested, repairable: true, review: it.confidence !== 'high', message: `Loan ${it.field} differs from its collection rows (${it.basis}).` });
        }
    }

    const order = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => order[a.severity] - order[b.severity]);
    return { issues, counts: { error: issues.filter((i) => i.severity === 'error').length, warning: issues.filter((i) => i.severity === 'warning').length, info: issues.filter((i) => i.severity === 'info').length } };
}
