// src/lib/support-edit-validate.js
// Pure validation for the Support Transaction Editor. Runs on the server (source of truth) and in the page (preview).
//
//   errors   -> HARD stop: the save is refused (impossible values, broken arithmetic, wrong types)
//   warnings -> SOFT: allowed only when the editor ticks "I reviewed these" (stored in the trail)
//
// ctx (all optional, loaded by the API): { loan, client, serviceChargeRate, today }
// `before` is the row as it is in the DB, `after` is before + the proposed changes.

import { ENTITIES, normalizeValue, toNum, remarkValue, remarkOptions } from './support-edit-config';

const TOL = 0.01;
const eq  = (a, b) => Math.abs(Number(a) - Number(b)) <= TOL;
const has = (v) => v !== null && v !== undefined && v !== '';
const fmt = (n) => Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isMultiple = (value, step) => step > 0 && Math.abs(value / step - Math.round(value / step)) < 1e-9;

export function validateEdit({ entity, before = {}, changes = [], ctx = {} }) {
    const cfg = ENTITIES[entity];
    const errors = [];
    const warnings = [];
    const err  = (field, message) => errors.push({ field, message });
    const warn = (field, message) => warnings.push({ field, message });

    if (!cfg) return { errors: [{ field: null, message: `Unknown record type "${entity}".` }], warnings };
    if (!changes.length) return { errors: [{ field: null, message: 'No changes to save.' }], warnings };

    const after = { ...before };
    for (const c of changes) after[c.field] = c.after;
    const changed = new Set(changes.map((c) => c.field));
    const touched = (...f) => f.some((x) => changed.has(x));

    // ── 1. per-field type / range ────────────────────────────────────────────
    for (const c of changes) {
        const def = cfg.fields[c.field];
        if (!def) { err(c.field, `"${c.field}" cannot be edited here.`); continue; }
        const v = c.after;
        if (def.type === 'remarks') {
            const rv = remarkValue(v);
            if (rv !== '' && !remarkOptions(before.occurence).some((o) => o.value === rv)) err(c.field, `"${rv}" is not a ${String(before.occurence ?? 'daily')} register remark.`);
            continue;
        }
        if (v === null || (def.type === 'text' && typeof v === 'string' && v.trim() === '' && !def.nullable)) { if (!def.nullable && def.type !== 'bool') err(c.field, `${def.label} cannot be empty.`); continue; }
        if (def.type === 'money' || def.type === 'int') {
            const n = toNum(v);
            if (!Number.isFinite(n)) { err(c.field, `${def.label} must be a number.`); continue; }
            if (def.type === 'int' && !Number.isInteger(n)) err(c.field, `${def.label} must be a whole number.`);
            if (n < 0 && !def.allowNegative) err(c.field, `${def.label} cannot be negative.`);
            if (n > 100000000) err(c.field, `${def.label} is unrealistically large.`);
            // big swings are usually a typo (extra zero)
            const prev = toNum(before[c.field]);
            if (def.type === 'money' && prev > 0 && n > prev * 5) warn(c.field, `${def.label} grows from ${fmt(prev)} to ${fmt(n)} (more than 5x). Check for an extra digit.`);
        }
        if (def.type === 'enum' && !def.options.includes(String(v))) err(c.field, `${def.label} must be one of: ${def.options.join(', ')}.`);
        if (def.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) err(c.field, `${def.label} must be a date (YYYY-MM-DD).`);
    }
    if (errors.length) return { errors, warnings };

    const n = (f) => toNum(after[f]);
    if (touched('branchId', 'groupId', 'loId')) warn('groupId', 'Identity (branch / group / loan officer) is being changed. Use Analyze > Repair so the values come from the group; a wrong id hides this record from its group.');

    // ── 2. entity rules ──────────────────────────────────────────────────────
    if (entity === 'loans') {
        const principal = n('principalLoan');
        const release   = n('amountRelease');
        // amountRelease = principalLoan * serviceChargeRate (total repayment, NOT cash disbursed).
        // Rate: the loan's own effective rate (saved data), never today's live setting.
        const oldP = toNum(before.principalLoan), oldR = toNum(before.amountRelease);
        const loanRate = oldP > 0 && oldR > 0 ? oldR / oldP : NaN;      // the loan's own rate (saved data)
        const settingsRate = toNum(ctx.serviceChargeRate);              // transactionSettings.serviceChargeRate (what AddLoanPage uses today)
        const RT = 1; // AddLoanPage stores unrounded values, the regional-manager edit modal rounds to whole pesos
        if (touched('principalLoan', 'amountRelease')) {
            if (!(principal > 0)) err('principalLoan', 'Principal loan must be greater than 0.');
            else {
                const okLoan = Number.isFinite(loanRate) && Math.abs(release - principal * loanRate) <= RT;
                const okSettings = Number.isFinite(settingsRate) && settingsRate > 0 && Math.abs(release - principal * settingsRate) <= RT;
                if (!Number.isFinite(loanRate) && !(settingsRate > 0)) {
                    if (release < principal) err('amountRelease', 'Amount release cannot be lower than the principal.');
                } else if (!okLoan && !okSettings) {
                    const exp = [Number.isFinite(loanRate) ? `${fmt(principal * loanRate)} (loan rate ${loanRate.toFixed(4)})` : null,
                        settingsRate > 0 ? `${fmt(principal * settingsRate)} (current rate ${settingsRate})` : null].filter(Boolean).join(' or ');
                    err('amountRelease', `Amount release must be principal x service charge rate: expected ${exp}; you entered ${fmt(release)}.`);
                } else if (!okLoan && okSettings && Number.isFinite(loanRate)) {
                    warn('amountRelease', `Uses the current service charge rate ${settingsRate}, but this loan was created with ${loanRate.toFixed(4)}.`);
                }
            }
        }
        if (n('loanBalance') > release + TOL) err('loanBalance', `Loan balance (${fmt(n('loanBalance'))}) cannot exceed the amount release (${fmt(release)}).`);
        if (touched('principalLoan') && principal > 0 && principal % 1000 !== 0) err('principalLoan', 'Principal loan must be divisible by 1000.');
        // activeLoan is the PER-INSTALLMENT amount = amountRelease / term (weekly 24, accelerated 12; daily 60 or 100).
        // targetCollection follows it. A matured past due loan legitimately has activeLoan = 0.
        const divisor = after.occurence === 'weekly' ? (after.weeklyScheduleType === 'accelerated' ? 12 : 24) : (n('loanTerms') === 60 ? 60 : 100);
        const installment = Math.round((release / divisor) * 100) / 100;
        if (touched('principalLoan', 'amountRelease', 'activeLoan') && after.maturedPD !== true && Math.abs(n('activeLoan') - installment) > 1) {
            warn('activeLoan', `Per-installment amount should be ${fmt(installment)} (${fmt(release)} / ${divisor}); you have ${fmt(n('activeLoan'))}.`);
        }
        if (touched('principalLoan', 'amountRelease', 'activeLoan', 'targetCollection') && after.maturedPD !== true && Math.abs(n('targetCollection') - n('activeLoan')) > 1) {
            warn('targetCollection', `Target collection (${fmt(n('targetCollection'))}) normally equals the per-installment amount (${fmt(n('activeLoan'))}).`);
        }
        if (touched('amountRelease') && !touched('loanRelease') && has(after.loanRelease) && !eq(n('loanRelease'), release)) warn('loanRelease', `Loan release (${fmt(n('loanRelease'))}) normally equals the amount release (${fmt(release)}).`);
        if (touched('lrfCollection') && ctx.lrfRate > 0 && Math.abs(n('lrfCollection') - principal * ctx.lrfRate) > 1) warn('lrfCollection', `LRF collection should be principal x ${ctx.lrfRate} = ${fmt(principal * ctx.lrfRate)}.`);
        if (touched('principalLoan') && !touched('lrfCollection')) warn('lrfCollection', 'Principal changed but the LRF collection (principal x LRF rate) was not updated.');
        if (has(after.loanTerms) && n('noOfPayments') > n('loanTerms')) err('noOfPayments', `No. of payments (${n('noOfPayments')}) cannot exceed the loan term (${n('loanTerms')}).`);
        if (has(after.startDate) && has(after.endDate) && String(after.endDate).slice(0, 10) < String(after.startDate).slice(0, 10)) err('endDate', 'End date cannot be before the start date.');
        if (has(after.mcbuWithdrawal) && n('mcbuWithdrawal') > n('mcbu') + TOL) warn('mcbuWithdrawal', `MCBU withdrawal (${fmt(n('mcbuWithdrawal'))}) is more than the MCBU balance (${fmt(n('mcbu'))}).`);
        if (has(after.csfWithdrawal) && n('csfWithdrawal') > n('csf') + TOL) warn('csfWithdrawal', `CSF withdrawal (${fmt(n('csfWithdrawal'))}) is more than the CSF balance (${fmt(n('csf'))}).`);

        if (touched('status', 'loanBalance', 'activeLoan')) {
            if (after.status === 'active' && eq(n('loanBalance'), 0)) warn('status', 'Active loan has a 0 balance; it should be completed.');
            if (after.status === 'closed' && n('loanBalance') > TOL) warn('status', `Closed loan still carries a balance of ${fmt(n('loanBalance'))} (expected only if the client was transferred).`);
            if (after.status === 'closed' && !has(after.closedDate)) warn('closedDate', 'A closed loan should have a closed date.');
        }
        if (touched('maturedPD', 'maturedPDDate')) {
            if (after.maturedPD === true && !has(after.maturedPDDate)) warn('maturedPDDate', 'A matured past due loan should have a matured past due date.');
            if (after.maturedPD !== true && has(after.maturedPDDate)) warn('maturedPD', 'A matured past due date is set but the loan is not flagged as matured past due.');
        }
        if (touched('maturedPD') && after.maturedPD === true && n('activeLoan') > TOL) warn('activeLoan', 'A matured past due loan normally has a 0 per-installment amount.');
        if (touched('reverted') && after.reverted === true) warn('reverted', 'Flagging a loan as reverted blocks its group on the register until it is resubmitted. Normally this is set by the revert action.');
        if (touched('status') && before.status === 'pending' && after.status === 'active' && !before.ldfApproved) warn('status', 'Loan is not LDF-approved yet; activating it skips the approval flow.');
        if (touched('status') && ['closed', 'reject'].includes(before.status) && ['active', 'pending'].includes(after.status)) warn('status', `Re-opening a ${before.status} loan can double-count the client's balances. Make sure no newer loan exists.`);
        if (touched('fullPaymentDate') && has(after.fullPaymentDate) && has(before.dateGranted) && String(after.fullPaymentDate).slice(0, 10) < String(before.dateGranted).slice(0, 10)) warn('fullPaymentDate', 'Full payment date is before the loan was granted.');
        if (touched('mcbu', 'mcbuCollection') && ctx.loan === undefined && ctx.openLoanCount > 1) warn('mcbu', 'Client has more than one open loan; check the MCBU belongs to this one.');
    }

    if (entity === 'cashCollections') {
        const pay = n('paymentCollection');
        const loan = ctx.loan;
        // The row does not carry its own installment, so fall back to the loan's per-installment amount (loan.activeLoan).
        const target = toNum(before.targetCollection) || toNum(loan?.activeLoan);
        if (has(after.amountRelease) && n('loanBalance') > n('amountRelease') + TOL) err('loanBalance', `Loan balance (${fmt(n('loanBalance'))}) cannot exceed the amount release (${fmt(n('amountRelease'))}).`);
        if (touched('paymentCollection') && target > 0 && pay > 0 && !isMultiple(pay, target)) {
            // a final payoff may legitimately be smaller than / not a multiple of the target
            const payoff = [loan?.loanBalance, loan?.activeLoan, before.activeLoan,
                toNum(before.loanBalance) + toNum(before.paymentCollection)].map(toNum).filter(Number.isFinite);
            if (!payoff.some((p) => eq(p, pay))) {
                err('paymentCollection', `Payment ${fmt(pay)} is not a multiple of the target collection ${fmt(target)}, and does not match the loan payoff.`);
            } else warn('paymentCollection', `Payment ${fmt(pay)} is not a multiple of the target ${fmt(target)}; accepted because it equals the payoff amount.`);
        }
        if (touched('paymentCollection') && target > 0 && pay > target && isMultiple(pay, target)) {
            warn('paymentCollection', `Payment ${fmt(pay)} is ${Math.round(pay / target)} installments of ${fmt(target)} (an advance payment). Check the number of payments and advance days.`);
        }
        if (touched('paymentCollection', 'excess') && target > 0) {
            const expectedExcess = pay > target ? Math.round((pay - target) * 100) / 100 : 0;
            if (has(after.excess) && !eq(n('excess'), expectedExcess)) warn('excess', `Excess is ${fmt(n('excess'))} but payment - target = ${fmt(expectedExcess)}.`);
        }
        if (touched('paymentCollection', 'remarks', 'mispayment') && pay === 0 && !has(remarkValue(after.remarks)) && !['pending', 'tomorrow'].includes(after.status)) warn('remarks', 'A no-payment row needs an Excused or Delinquent remark.');
        if (touched('paymentCollection', 'mispayment') && pay > 0 && (after.mispayment === true)) warn('mispayment', 'Row is flagged as a mispayment but has a payment.');
        if (touched('paymentCollection', 'mcbuCol') && pay === 0 && n('mcbuCol') > 0 && !/offset|reloan/i.test(remarkValue(after.remarks))) warn('mcbuCol', 'MCBU collection with no payment collection; check the remark.');
        if (touched('remarks', 'closeRemarks') && /^offset/.test(remarkValue(after.remarks)) && !has(after.closeRemarks)) warn('closeRemarks', 'A close / offset remark normally comes with close remarks (the register asks for them).');
        if (touched('mcbuWithdrawal', 'mcbu') && n('mcbuWithdrawal') > n('mcbu') + TOL && n('mcbuWithdrawal') > 0) warn('mcbuWithdrawal', 'MCBU withdrawal is more than the MCBU balance on this row.');
        if (touched('draft') && after.draft === true && loan && ['completed', 'closed'].includes(loan.status)) warn('draft', 'Fully paid rows should not stay as draft.');
    }

    // A full payment date only makes sense on a COMPLETED loan / row.
    if ((entity === 'loans' || entity === 'cashCollections') && has(after.fullPaymentDate) && after.status !== 'completed'
        && touched('status', 'fullPaymentDate')) {
        const st = String(after.status ?? '');
        const msg = `A full payment date is set but the status is "${st || '—'}". Set the status to completed, or clear the date.`;
        if (st === 'closed') warn('fullPaymentDate', msg); else err('fullPaymentDate', msg);
    }

    // A COMPLETED loan / row is fully paid: nothing left to collect and a payoff date that is today or earlier.
    if ((entity === 'loans' || entity === 'cashCollections') && after.status === 'completed'
        && touched('status', 'loanBalance', 'activeLoan', 'fullPaymentDate')) {
        const today = ctx.today ?? new Date().toISOString().slice(0, 10);
        if (n('loanBalance') > TOL) err('loanBalance', `A completed loan must have a 0 balance (currently ${fmt(n('loanBalance'))}).`);
        if (n('activeLoan') > TOL) err('activeLoan', `A completed loan must have a 0 active loan (currently ${fmt(n('activeLoan'))}).`);
        if (!has(after.fullPaymentDate)) err('fullPaymentDate', 'A completed loan needs a full payment date.');
        else if (String(after.fullPaymentDate).slice(0, 10) > today) err('fullPaymentDate', `Full payment date ${String(after.fullPaymentDate).slice(0, 10)} is in the future (today is ${today}).`);
    }

    if (entity === 'badDebtCollections') {
        if (has(after.maturedPastDue) && n('paymentCollection') > n('maturedPastDue') + TOL) warn('paymentCollection', `Payment (${fmt(n('paymentCollection'))}) is more than the matured past due (${fmt(n('maturedPastDue'))}).`);
        if (ctx.loan && n('paymentCollection') > toNum(ctx.loan.maturedPastDue) + TOL && toNum(ctx.loan.maturedPastDue) >= 0) warn('paymentCollection', `Payment is more than the loan's matured past due (${fmt(ctx.loan.maturedPastDue)}).`);
    }

    if (entity === 'mcbu_withdrawals') {
        const loan = ctx.loan;
        if (loan && touched('mcbu_withdrawal_amount') && n('mcbu_withdrawal_amount') > toNum(loan.mcbu) + TOL) err('mcbu_withdrawal_amount', `MCBU withdrawal (${fmt(n('mcbu_withdrawal_amount'))}) is more than the loan's MCBU (${fmt(loan.mcbu)}).`);
        if (loan && touched('csf_withdrawal_amount') && n('csf_withdrawal_amount') > toNum(loan.csf) + TOL) err('csf_withdrawal_amount', `CSF withdrawal (${fmt(n('csf_withdrawal_amount'))}) is more than the loan's CSF (${fmt(loan.csf)}).`);
        if (touched('csf_withdrawal_amount') && n('csf_withdrawal_amount') > 0 && before.group_leader === false) warn('csf_withdrawal_amount', 'CSF withdrawal on a client who is not a group leader.');
        if (after.status === 'approved' && !has(after.approved_date)) warn('approved_date', 'Approved withdrawal should have an approved date.');
        if (after.status === 'rejected' && !has(after.rejected_date)) warn('rejected_date', 'Rejected withdrawal should have a rejected date.');
        if (touched('mcbu_withdrawal_amount', 'csf_withdrawal_amount') && before.status === 'approved') warn('status', 'Withdrawal is already approved: the loan/client balances and cashCollections are NOT recalculated by this edit. Fix them separately.');
    }

    if (entity === 'client') {
        for (const f of ['firstName', 'lastName']) if (touched(f) && !String(after[f] ?? '').trim()) err(f, `${ENTITIES.client.fields[f].label} cannot be blank.`);
        if (touched('contactNumber') && has(after.contactNumber) && !/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(String(after.contactNumber).replace(/[\s-]/g, ''))) warn('contactNumber', 'Contact number is not a valid Philippine mobile number.');
        if (touched('addressZipCode') && has(after.addressZipCode) && !/^\d{4}$/.test(String(after.addressZipCode))) warn('addressZipCode', 'Zip code should be 4 digits.');
        if (touched('birthdate') && has(after.birthdate)) {
            const today = ctx.today ?? new Date().toISOString().slice(0, 10);
            const bd = String(after.birthdate).slice(0, 10);
            if (bd >= today) err('birthdate', 'Birthdate must be in the past.');
            else if (today.slice(0, 4) - bd.slice(0, 4) < 18) warn('birthdate', 'Client would be under 18.');
        }
        if (touched('status') && before.status === 'active' && after.status !== 'active' && ctx.openLoanCount > 0) warn('status', `Client still has ${ctx.openLoanCount} open loan(s).`);
        if (touched('firstName', 'lastName', 'middleName')) warn('firstName', 'Name changes do NOT update the fullName copy stored on the client loans / cashCollections; those rows keep the old name.');
    }

    return { errors, warnings };
}

export { normalizeValue };
