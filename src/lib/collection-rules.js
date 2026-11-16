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
    PARTIAL_PAYMENT: 'PARTIAL_PAYMENT',
    OVERPAYMENT_REMARK_REQUIRED: 'OVERPAYMENT_REMARK_REQUIRED',
    CSF_NOT_MULTIPLE_OF_5: 'CSF_NOT_MULTIPLE_OF_5',
    REMARK_REQUIRED_FOR_ZERO_PAYMENT: 'REMARK_REQUIRED_FOR_ZERO_PAYMENT',
};

/**
 * @param {Array} rows client rows (client state rows, or saveV2 payload rows)
 * @param {{csfEnabled:boolean, dayName?:string, checkOverpaymentRemark?:boolean}} opts dayName: only rows of the group's collection day are checked for payment/CSF rules.
 * checkOverpaymentRemark (pages only, default off so the server is unaffected): double / advance payments need a matching remark on Save Draft too.
 * checkEntryRules (pages only, default off): the entry-time rules also hold on Save Draft: CSF above 5 in multiples of 5, and a 0 payment in a collecting group needs a remark.
 * @returns {Array<{code:string,message:string,clientId?:string,name?:string}>}
 */
export const findHardRuleViolations = (rows, { csfEnabled = false, dayName, skipPersistedClosed = false, checkOverpaymentRemark = false, checkEntryRules = false } = {}) => {
    const out = [];
    // The group is being collected when any active row carries a payment. Then the leader needs a CSF
    // collection even if the leader row itself is still at 0, so Save Draft enforces the same leader-CSF
    // rule as Submit (otherwise a draft with a leader at CSF 0 is accepted and only fails later on Submit).
    const groupHasPayment = (rows || []).some((r) => r && r.status === 'active' && toNum(r.paymentCollection) > 0);
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
        const leaderOfCollectingGroup = groupHasPayment && cc.status === 'active' && toNum(cc.loanBalance) > 0
            && !cc.maturedPD && (cc.transferStr == null || cc.transferStr === '-');
        if (csfEnabled && cc.groupLeader && (collecting || settling || leaderOfCollectingGroup) && !isCsfExempt(cc) && !isOffsetRemark(cc)
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
        // Rule 5: a payment below the target collection is not allowed (a payoff of the remaining balance is
        // fine: that row has balance 0 after the payment and is not 'collecting'). Remarks like Excused,
        // Delinquent or Past Due are exempt; so are offsets.
        if (collecting && target > 0 && pay > 0 && pay < target && !isMispayOrExemptRemark(cc) && !isOffsetRemark(cc)) {
            out.push({ ...base, code: CODES.PARTIAL_PAYMENT,
                message: `Actual collection is below the target collection of ${target}. Enter the full target or choose a remark.` });
        }
        // Rule 6 (pages only): a multiple-of-target overpayment must carry a matching remark, on Save Draft as on Submit.
        // Same wording as the Submit validation so the two never show as duplicates.
        if (checkOverpaymentRemark && collecting && target > 0 && pay >= target * 2 && pay % target === 0 && !isMispayOrExemptRemark(cc)) {
            const r = remarkValue(cc);
            const who = cc.fullName && cc.fullName !== '-' ? `${cc.fullName}: ` : '';
            if (pay > target * 2 && r !== 'advance payment') {
                out.push({ ...base, code: CODES.OVERPAYMENT_REMARK_REQUIRED,
                    message: `${who}Error occured. Actual collection is a advance payment please set remarks as Advance Payment.` });
            } else if (pay === target * 2 && r !== 'double payment' && r !== 'advance payment') {
                out.push({ ...base, code: CODES.OVERPAYMENT_REMARK_REQUIRED,
                    message: `${who}Error occured. Actual collection is a double payment please set remarks as Double Payment or Advance Payment.` });
            }
        }
        // Rule 7 (pages only): same entry-time rule as the CSF input (above 5 = multiples of 5), so a draft cannot persist e.g. CSF 7.
        if (checkEntryRules && cc.status === 'active' && toNum(cc.csfCollection) > 5 && toNum(cc.csfCollection) % 5 !== 0) {
            const who = cc.fullName && cc.fullName !== '-' ? `${cc.fullName}: ` : '';
            out.push({ ...base, code: CODES.CSF_NOT_MULTIPLE_OF_5,
                message: `${who}Error occured. CSF collection must be divisible by 5.` });
        }
        // Rule 8 (pages only): in a group that is being collected, a row with 0 payment needs a remark. Same wording as Submit.
        const dueToday = dayName ? (cc.group?.day === dayName || cc.groupDay === dayName) : true; // pages only: a 0 row has no payment to infer the day from
        if (checkEntryRules && groupHasPayment && cc.status === 'active' && toNum(cc.loanBalance) > 0 && dueToday && !cc.maturedPD
            && (cc.transferStr == null || cc.transferStr === '-') && toNum(cc.paymentCollection) === 0 && !remarkValue(cc)) {
            const who = cc.fullName && cc.fullName !== '-' ? `${cc.fullName}: ` : '';
            out.push({ ...base, code: CODES.REMARK_REQUIRED_FOR_ZERO_PAYMENT,
                message: `${who}Error occured. Please select a remarks for 0 or no payment Actual Collection.` });
        }
    });
    return out;
};

export const hardRuleMessages = (violations) => Array.from(new Set((violations || []).map((v) => v.message)));

// Server-side sanitizer: a completed (fully paid) row must never persist a phantom target/payment.
export const sanitizeCompletedRow = (cc) => {
    if (!cc || cc.status !== 'completed' || toNum(cc.loanBalance) > 0) return cc;
    cc.targetCollection = 0;
    // a payment made today (prior balance > 0) is real: keep it; only wipe phantom amounts on already-paid loans
    if (isOffsetRemark(cc) && !(toNum(cc.prevData?.loanBalance) > 0)) {
        cc.paymentCollection = 0;
        cc.excess = 0;
    }
    return cc;
};
