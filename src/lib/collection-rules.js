// Shared hard business rules for Loan Officer Register (LOR) saves.
// Used by the daily/weekly client pages (also on Save Draft) and by saveV2 (server enforcement).
// Pure functions only: no React, no DB.

const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const remarkValue = (cc) => (typeof cc?.remarks === 'string' ? cc.remarks : cc?.remarks?.value) || '';

export const isOffsetRemark = (cc) => remarkValue(cc).startsWith('offset-');

// remarks that legitimately skip CSF / exact-multiple payment rules
export const isMispayOrExemptRemark = (cc) => {
    const r = remarkValue(cc);
    return r.startsWith('delinquent') || r.startsWith('excused') || r === 'past due'
        || r === 'past due collection' || r.startsWith('collection-') || r === 'matured-past due'
        || r === 'offset-matured-pd';
};

const isCsfExempt = (cc) => {
    const r = remarkValue(cc);
    return r.startsWith('delinquent') || r.startsWith('excused') || r === 'past due';
};

export const CODES = {
    OFFSET_REASON_REQUIRED: 'OFFSET_REASON_REQUIRED',
    LEADER_CSF_REQUIRED: 'LEADER_CSF_REQUIRED',
    NOT_MULTIPLE_OF_TARGET: 'NOT_MULTIPLE_OF_TARGET',
    PHANTOM_COMPLETED_AMOUNTS: 'PHANTOM_COMPLETED_AMOUNTS',
};

/**
 * @param {Array} rows client rows (client state rows, or saveV2 payload rows)
 * @param {{csfEnabled:boolean, dayName?:string}} opts dayName: only rows of the group's collection day are checked for payment/CSF rules
 * @returns {Array<{code:string,message:string,clientId?:string,name?:string}>}
 */
export const findHardRuleViolations = (rows, { csfEnabled = false, dayName, skipPersistedClosed = false } = {}) => {
    const out = [];
    (rows || []).forEach((cc) => {
        if (!cc || cc.status === 'totals') return;
        // page only: rows already saved as closed (loaded from DB) are history, not new input.
        // The server must NOT set this: new offsets arrive with status 'closed' in the payload.
        if (skipPersistedClosed && cc.status === 'closed') return;
        const base = { clientId: cc.clientId, name: cc.fullName || cc.name };

        // Rule 1: offset needs a reason (checked for every offset row, draft or not)
        if (isOffsetRemark(cc) && !String(cc.closeRemarks ?? cc.closeAccountRemarks ?? '').trim()) {
            out.push({ ...base, code: CODES.OFFSET_REASON_REQUIRED,
                message: 'Offset requires a reason. Please enter the close account remarks.' });
        }

        // Rule 4: a completed (fully paid) client must not carry a phantom target / payment
        if (cc.status === 'completed' && (isOffsetRemark(cc) || remarkValue(cc).startsWith('reloaner'))
            && toNum(cc.loanBalance) <= 0 && toNum(cc.paymentCollection) === 0 && toNum(cc.targetCollection) > 0) {
            out.push({ ...base, code: CODES.PHANTOM_COMPLETED_AMOUNTS,
                message: 'Completed client must not carry a target collection.' });
        }

        // server has no dayName: only rows that actually carry a payment are treated as collecting
        const onCollectionDay = dayName ? (cc.group?.day === dayName || cc.groupDay === dayName) : toNum(cc.paymentCollection) > 0;
        const collecting = cc.status === 'active' && toNum(cc.loanBalance) > 0 && onCollectionDay
            && !cc.maturedPD && (cc.transferStr == null || cc.transferStr === '-');
        const settling = cc.status === 'active' && toNum(cc.paymentCollection) > 0;

        // Rule 2: group leader must have CSF collection > 0 (unless delinquent / excused / past due)
        if (csfEnabled && cc.groupLeader && (collecting || settling) && !isCsfExempt(cc) && !isOffsetRemark(cc)
            && toNum(cc.csfCollection) <= 0) {
            out.push({ ...base, code: CODES.LEADER_CSF_REQUIRED,
                message: 'Group leader must have a CSF Collection greater than 0.' });
        }

        // Rule 3: an overpayment that is not a multiple of the target is not allowed (independent of remarks)
        const target = toNum(cc.activeLoan);
        const pay = toNum(cc.paymentCollection);
        if (collecting && target > 0 && pay > target && pay % target !== 0 && !isMispayOrExemptRemark(cc)) {
            out.push({ ...base, code: CODES.NOT_MULTIPLE_OF_TARGET,
                message: `Actual collection should be divisible by ${target}.` });
        }
    });
    return out;
};

export const hardRuleMessages = (violations) => Array.from(new Set((violations || []).map((v) => v.message)));

// Server-side sanitizer: a completed (fully paid) row must never persist a phantom target/payment.
export const sanitizeCompletedRow = (cc) => {
    if (!cc || cc.status !== 'completed' || toNum(cc.loanBalance) > 0) return cc;
    cc.targetCollection = 0;
    if (isOffsetRemark(cc)) {
        cc.paymentCollection = 0;
        cc.excess = 0;
    }
    return cc;
};
