// src/lib/lor-row-rules.js
// Pure. LOR-style checks for ONE cashCollections row (+ its loan), for the support editor.
// MIMICS the rules of the daily/weekly LOR pages and collection-rules.js; it does not replace or change them.
// Returns { errors, warnings } as [{ field, message }].
// Errors are limited to rules the LOR itself refuses (offset reason, leader CSF, CSF multiple of 5).
// Everything else is a warning: support fixes bad data, so a hard block here would trap legitimate repairs.

import { isOffsetRemark, isMispayOrExemptRemark } from '@/lib/collection-rules';

const toNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const rv = (r) => (typeof r === 'string' ? r : r?.value) || '';
const fmt = (n) => Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MCBU_PER_PAYMENT = { daily: 15, weekly: 75 };

/**
 * @param {object} p
 * @param {object} p.row   the row AFTER the edit
 * @param {object} [p.loan] the loan (current DB state)
 * @param {object} [p.group] { occurence, csfEnabled }
 * @param {Set<string>} [p.touched] fields changed by this edit (rules only fire when relevant fields changed)
 */
export function checkLorRowRules({ row, loan, group, touched = new Set() }) {
    const errors = [];
    const warnings = [];
    const err = (field, message) => errors.push({ field, message });
    const warn = (field, message) => warnings.push({ field, message });
    const t = (...f) => f.some((x) => touched.has(x));

    const occ = String(group?.occurence ?? row.occurence ?? 'daily').toLowerCase();
    const remark = rv(row.remarks);
    const pay = toNum(row.paymentCollection);
    const target = toNum(row.targetCollection) || toNum(row.activeLoan) || toNum(loan?.activeLoan);
    const balance = toNum(row.loanBalance);
    const offset = isOffsetRemark(row);
    const reloaner = remark.startsWith('reloaner');
    const mispay = remark.startsWith('delinquent') || remark.startsWith('excused');

    // 1. Offset: needs a reason (LOR refuses) and must be consistent with the status / balance
    if (t('remarks', 'closeRemarks') && offset && !String(row.closeRemarks ?? '').trim()) err('closeRemarks', 'Offset requires a reason. Enter the close remarks.');
    if (t('remarks', 'status') && offset) {
        if (row.status === 'active') warn('status', 'Remark is an offset but the row status is still "active". An offset closes the loan: set the status to closed (and update the loan).');
        if (loan && loan.status === 'active') warn('remarks', 'Remark is an offset but the loan is still active. Close the loan too (loan status, balance 0) or the client keeps being collected.');
        if (balance > 0 && rv(row.remarks) !== 'offset-matured-pd' && !row.maturedPD) warn('loanBalance', `Offset with a remaining balance of ${fmt(balance)}. The LOR requires the full balance to be paid (or offset with MCBU) before closing.`);
        if (toNum(row.mcbuReturnAmt) <= 0 && toNum(row.mcbu) > 0) warn('mcbuReturnAmt', 'Offset normally returns the MCBU (MCBU return is 0).');
    }
    if (t('remarks', 'status') && !offset && row.status === 'closed' && remark) warn('remarks', 'Row is closed but the remark is not an offset remark.');

    // 2. Reloaner / completed consistency
    if (t('remarks', 'status') && reloaner && row.status === 'active' && balance > 0) warn('remarks', 'Reloaner remark on a row that still has a balance. A reloaner is a fully paid loan (status completed, balance 0).');
    if (t('remarks', 'status', 'loanBalance') && row.status === 'completed' && balance <= 0 && !offset && !reloaner && remark !== 'pending') warn('remarks', 'A fully paid row needs a Pending, Reloaner or Offset remark (the LOR requires it).');
    if (t('remarks', 'targetCollection', 'status') && row.status === 'completed' && (offset || reloaner) && balance <= 0 && pay === 0 && toNum(row.targetCollection) > 0) warn('targetCollection', 'A completed client with an offset/reloaner remark should not carry a target collection.');

    // 3. Excused / delinquent: no collection
    if (t('remarks', 'paymentCollection') && mispay && pay > 0 && row.status === 'active') warn('paymentCollection', `Remark is ${remark} but the row has a payment of ${fmt(pay)}. Excused/Delinquent rows normally collect nothing.`);

    // 4. Payment vs remark (active, collecting rows)
    const collecting = row.status === 'active' && balance > 0 && !row.maturedPD;
    if (collecting && target > 0 && t('paymentCollection', 'remarks')) {
        if (pay > 0 && pay < target && !isMispayOrExemptRemark(row) && !offset) warn('paymentCollection', `Payment ${fmt(pay)} is below the target ${fmt(target)}; the LOR requires the full target or an Excused/Delinquent/Past due remark.`);
        if (pay > target && pay % target === 0 && !isMispayOrExemptRemark(row)) {
            if (pay === target * 2 && remark !== 'double payment' && remark !== 'advance payment') warn('remarks', 'Payment is double the target: the LOR requires the Double Payment or Advance Payment remark.');
            if (pay > target * 2 && remark !== 'advance payment') warn('remarks', 'Payment is more than double the target: the LOR requires the Advance Payment remark.');
        }
        if (pay === 0 && !remark) warn('remarks', 'A no-payment row needs a Past due, Delinquent or Excused remark.');
    }

    // 5. CSF
    const csfOn = group?.csfEnabled !== false;
    const csf = toNum(row.csfCollection);
    if (t('csfCollection') && csf > 5 && csf % 5 !== 0) err('csfCollection', 'CSF collection above 5 must be in multiples of 5.');
    if (csfOn && row.groupLeader && t('csfCollection', 'remarks', 'paymentCollection') && row.status === 'active' && pay > 0 && csf <= 0 && !mispay && remark !== 'past due' && !offset) err('csfCollection', 'Group leader must have a CSF collection greater than 0.');

    // 6. MCBU per payment (weekly 75, daily 15) vs payments made
    const per = MCBU_PER_PAYMENT[occ === 'weekly' ? 'weekly' : 'daily'];
    if (t('mcbuCol', 'paymentCollection') && collecting && target > 0 && pay > 0 && !mispay && !isMispayOrExemptRemark(row)) {
        const payments = Math.max(Math.floor(pay / target), 1);
        const expected = per * payments;
        if (toNum(row.mcbuCol) < expected) warn('mcbuCol', `MCBU collection ${fmt(toNum(row.mcbuCol))} is below the usual ${fmt(expected)} (${fmt(per)} x ${payments} payment${payments > 1 ? 's' : ''}, ${occ}).`);
    }
    if (t('mcbuCol') && toNum(row.mcbuCol) > per && toNum(row.mcbuCol) % 5 !== 0) warn('mcbuCol', 'MCBU collection should be divisible by 5.');

    // 7. Matured PD offset
    if (t('remarks') && remark === 'offset-matured-pd') {
        if (!(row.maturedPD || loan?.maturedPD)) warn('remarks', 'Offset - Matured PD on a loan that is not flagged as matured past due.');
        if (toNum(row.pastDue) > 0 || toNum(loan?.pastDue) > 0) warn('remarks', 'Matured PD offset requires a past due of 0 on both the row and the loan.');
    }

    return { errors, warnings };
}

/** Loan side of the user's example: loan remarks / status say offset or closed but the other fields disagree. */
export function checkLorLoanRules({ loan, touched = new Set() }) {
    const warnings = [];
    const warn = (field, message) => warnings.push({ field, message });
    const r = String(loan.remarks ?? '').toLowerCase();
    if (touched.has('remarks') && /offset/.test(r) && loan.status === 'active') warn('status', 'Loan remarks say offset but the loan status is still "active". Set the status to closed if the loan is offset.');
    if (touched.has('status') && loan.status === 'closed' && toNum(loan.loanBalance) > 0) warn('loanBalance', `Loan is closed but the balance is ${fmt(toNum(loan.loanBalance))}.`);
    return { warnings };
}
