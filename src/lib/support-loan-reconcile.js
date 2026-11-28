// src/lib/support-loan-reconcile.js  (pure)
// "Next step" after a support edit on a cashCollections row: does the LOAN still match its collection rows?
// saveV2 rolls rows up into the loan like this (see saveV2.js, updateLoan):
//   loan.loanBalance / mcbu / csf / noOfPayments / advanceDays / pastDue  = values of the LATEST saved row
//   loan.mcbuCollection / csfCollection                                   = running sum of the rows
// Support decides per field whether to apply the suggestion or skip it; nothing is applied here.

import { ENTITIES, sameValue } from './support-edit-config';

const LATEST_FIELDS = ['loanBalance', 'mcbu', 'csf', 'noOfPayments', 'advanceDays', 'pastDue'];
const SUM_FIELDS = { mcbuCollection: 'mcbuCol', csfCollection: 'csfCollection' };
const ELIGIBLE_STATUS = ['active', 'completed', 'closed'];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function computeLoanReconciliation(loan, rows) {
    const saved = (rows ?? []).filter((r) => r.draft !== true && ELIGIBLE_STATUS.includes(r.status));
    const latest = saved[0] ?? null; // rows arrive newest first
    if (!loan || !latest) return { latest: null, items: [], rowCount: saved.length };

    const defs = ENTITIES.loans.fields;
    const items = [];
    for (const f of LATEST_FIELDS) {
        const suggested = latest[f] === '-' ? 0 : latest[f];
        if (suggested === null || suggested === undefined) continue;
        if (!sameValue(defs[f] ?? { type: 'money' }, loan[f], suggested)) {
            items.push({ field: f, current: loan[f] ?? null, suggested, basis: `latest saved row ${String(latest.dateAdded).slice(0, 10)}`, confidence: 'high' });
        }
    }
    for (const [loanField, rowField] of Object.entries(SUM_FIELDS)) {
        const sum = Math.round(saved.reduce((t, r) => t + num(r[rowField]), 0) * 100) / 100;
        if (!sameValue(defs[loanField], loan[loanField], sum)) {
            items.push({ field: loanField, current: loan[loanField] ?? null, suggested: sum, basis: `sum of ${saved.length} saved rows`, confidence: 'review' });
        }
    }
    if (latest.status !== loan.status) {
        items.push({ field: 'status', current: loan.status ?? null, suggested: latest.status, basis: 'status of the latest saved row', confidence: 'review' });
    }
    return { latest: { _id: latest._id, dateAdded: latest.dateAdded, status: latest.status }, items, rowCount: saved.length };
}
