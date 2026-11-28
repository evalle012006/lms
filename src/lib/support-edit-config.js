// src/lib/support-edit-config.js
// Pure module (no server imports) shared by the Support Transaction Editor API and page.
// ONE definition of: who may use it, which tables/fields may be edited, and each field's type.
// Anything not listed here can NOT be changed through the editor (ids, history, biometrics, photos, ...).

export const SUPPORT_ROLE = 'support';

import { getShortCode, isAdminLevel } from './roles';
import { LOR_DAILY_REMARKS, LOR_WEEKLY_REMARKS, LOR_ONLY_DAILY_RELOAN_OFFSET_REMARKS, LOR_ONLY_WEEKLY_RELOAN_OFFSET_REMARKS } from './constants';
export { getShortCode };
export const canUseSupportEditor = (user) => isAdminLevel(user);

// Future: restrict a support user to specific branches. Today every support user sees every branch (returns null).
// To enable later, return an array of branch ids for the user, e.g. from a `supportBranchIds` column or a mapping table.
// Both the browse API and the editor read this single function, so nothing else needs to change.
export const getSupportBranchScope = (user) => {
    // const ids = user?.supportBranchIds; return Array.isArray(ids) && ids.length ? ids : null;
    return null;
};

export const MIN_REASON_LENGTH = 10;

// field types: money (>= 0, 2dp), int (>= 0), text, enum (options), date (YYYY-MM-DD), bool
const money = (label, extra = {}) => ({ label, type: 'money', ...extra });
const int   = (label, extra = {}) => ({ label, type: 'int', ...extra });
const text  = (label, extra = {}) => ({ label, type: 'text', ...extra });
const date  = (label, extra = {}) => ({ label, type: 'date', ...extra });
const bool  = (label, extra = {}) => ({ label, type: 'bool', ...extra });

export const LOAN_STATUSES = ['pending', 'active', 'completed', 'closed', 'reject'];

export const ENTITIES = {
    loans: {
        label: 'Loan',
        table: 'loans',
        idField: '_id',
        // read-only context shown/used for validation
        context: ['_id', 'clientId', 'fullName', 'groupName', 'slotNo',
            'occurence', 'loanTerms', 'weeklyScheduleType', 'ldfApproved'],
        fields: {
            status:            { label: 'Status', type: 'enum', options: LOAN_STATUSES },
            principalLoan:     money('Principal loan'),
            amountRelease:     money('Amount release (total repayment)'),
            activeLoan:        money('Active loan (per-installment amount)'),
            targetCollection:  money('Target collection (per installment)'),
            loanRelease:       money('Loan release'),
            lrfCollection:     money('LRF collection'),
            loanBalance:       money('Loan balance'),
            mcbu:              money('MCBU balance'),
            mcbuCollection:    money('MCBU collection'),
            mcbuReturnAmt:     money('MCBU return'),
            mcbuWithdrawal:    money('MCBU withdrawal'),
            csf:               money('CSF'),
            csfCollection:     money('CSF collection'),
            csfWithdrawal:     money('CSF withdrawal'),
            csfReturnAmt:      money('CSF return'),
            csfIn:             money('CSF in'),
            noOfPayments:      int('No. of payments'),
            advanceDays:       { label: 'Advance days', type: 'int', allowNegative: true },
            mispayment:        int('Mispayments'),
            pastDue:           money('Past due'),
            noPastDue:         int('No. of past due'),
            maturedPastDue:    money('Matured past due'),
            dateGranted:       date('Date granted'),
            startDate:         date('Start date'),
            endDate:           date('End date'),
            fullPaymentDate:   date('Full payment date', { nullable: true }),
            closedDate:        date('Closed date', { nullable: true }),
            remarks:           text('Remarks', { nullable: true }),
            // ---- written by save / saveV2 / loan release; added so support can correct them in one place ----
            // identity: normally changed only through Analyze > Repair (values come from the group)
            branchId:          text('Branch ID', { hidden: true }),
            groupId:           text('Group ID', { hidden: true }),
            loId:              text('Loan officer ID', { hidden: true }),
            loanCycle:         int('Loan cycle'),
            mcbuTarget:        money('MCBU target'),
            dateOfRelease:     date('Date of release', { nullable: true }),
            ciName:            text('CI name', { nullable: true }),
            advanceTransaction: bool('Advance transaction'),
            admissionCollection:     money('Admission collection'),
            cbhbCollection:          money('CBHB collection'),
            otherPassbookCollection: money('Other passbook collection'),
            otherPictureCollection:  money('Other picture collection'),
            addHospitalization:      money('Add hospitalization'),
            maturedPD:         bool('Matured past due (flag)'),
            maturedPDDate:     date('Matured past due date', { nullable: true }),
            reverted:          bool('Reverted (flag)'),
            bmRevertCount:     int('BM revert count'),
        },
    },
    cashCollections: {
        label: 'Cash collection',
        table: 'cashCollections',
        idField: '_id',
        context: ['_id', 'clientId', 'loanId', 'fullName', 'groupName', 'slotNo',
            'dateAdded', 'occurence', 'loanCycle', 'loanTerms', 'amountRelease'],
        fields: {
            branchId:          text('Branch ID', { hidden: true }),
            groupId:           text('Group ID', { hidden: true }),
            loId:              text('Loan officer ID', { hidden: true }),
            status:            { label: 'Status', type: 'enum', options: ['pending', 'active', 'completed', 'closed', 'tomorrow', 'reject'] },
            paymentCollection: money('Payment collection'),
            excess:            money('Excess'),
            activeLoan:        money('Active loan (after)'),
            loanBalance:       money('Loan balance (after)'),
            mcbu:              money('MCBU balance (after)'),
            mcbuCol:           money('MCBU collection'),
            mcbuReturnAmt:     money('MCBU return'),
            mcbuWithdrawal:    money('MCBU withdrawal'),
            mcbuInterest:      money('MCBU interest'),
            csf:               money('CSF balance (after)'),
            csfCollection:     money('CSF collection'),
            csfWithdrawal:     money('CSF withdrawal'),
            csfReturnAmt:      money('CSF return'),
            csfIn:             money('CSF in'),
            noOfPayments:      int('No. of payments'),
            advanceDays:       { label: 'Advance days', type: 'int', allowNegative: true },
            mispayment:        bool('Mispayment'),
            noMispayment:      int('No. of mispayments'),
            pastDue:           money('Past due'),
            noPastDue:         int('No. of past due'),
            fullPayment:       money('Full payment'),
            fullPaymentDate:   date('Full payment date', { nullable: true }),
            currentReleaseAmount: money('Current release amount'),
            remarks:           { label: 'Remarks', type: 'remarks', nullable: true },
            closeRemarks:      text('Close remarks', { nullable: true }),
            draft:             bool('Draft'),
        },
    },
    badDebtCollections: {
        label: 'Bad debt collection',
        table: 'badDebtCollections',
        idField: '_id',
        context: ['_id', 'clientId', 'loanId', 'branchId', 'groupId', 'loId', 'dateAdded', 'loanRelease'],
        fields: {
            paymentCollection: money('Payment collection'),
            maturedPastDue:    money('Matured past due'),
            mcbu:              money('MCBU'),
            dateAdded:         date('Date added'),
        },
    },
    mcbu_withdrawals: {
        label: 'MCBU / CSF withdrawal',
        table: 'mcbu_withdrawals',
        idField: '_id',
        context: ['_id', 'client_id', 'loan_id', 'branch_id', 'group_id', 'lo_id', 'group_leader', 'inserted_date'],
        fields: {
            mcbu_withdrawal_amount: money('MCBU withdrawal amount'),
            csf_withdrawal_amount:  money('CSF withdrawal amount'),
            status:                 { label: 'Status', type: 'enum', options: ['pending', 'approved', 'rejected'] },
            approved_date:          date('Approved date', { nullable: true }),
            rejected_date:          date('Rejected date', { nullable: true }),
            reason:                 text('Reason', { nullable: true }),
        },
    },
    client: {
        label: 'Client',
        table: 'client',
        idField: '_id',
        context: ['_id', 'fullName'],
        fields: {
            branchId:       text('Branch ID', { hidden: true }),
            groupId:        text('Group ID', { hidden: true }),
            loId:           text('Loan officer ID', { hidden: true }),
            firstName:      text('First name'),
            middleName:     text('Middle name', { nullable: true }),
            lastName:       text('Last name'),
            birthdate:      date('Birthdate', { nullable: true }),
            contactNumber:  text('Contact number', { nullable: true }),
            address:        text('Address', { nullable: true }),
            addressStreetNo:               text('Street no.', { nullable: true }),
            addressBarangayDistrict:       text('Barangay / district', { nullable: true }),
            addressMunicipalityCity:       text('Municipality / city', { nullable: true }),
            addressProvince:               text('Province', { nullable: true }),
            addressZipCode:                text('Zip code', { nullable: true }),
            status:         { label: 'Status', type: 'enum', options: ['active', 'pending', 'offset', 'inactive', 'resigned', 'null'] },
            delinquent:     bool('Delinquent'),
            groupLeader:    bool('Group leader'),
        },
    },
};

export const ENTITY_KEYS = Object.keys(ENTITIES);
export const editableFieldNames = (entity) => Object.keys(ENTITIES[entity]?.fields ?? {});
export const fetchFieldNames = (entity) => {
    const cfg = ENTITIES[entity];
    return [...new Set([cfg.idField, ...cfg.context, ...Object.keys(cfg.fields)])];
};

// ── LOR remarks ─────────────────────────────────────────────────────────────────
// cashCollections.remarks is stored the way the LOR stores it: { label, value } (or '' for none). The choices follow the
// group's occurence, exactly like the daily / weekly register lists.
export const remarkValue = (r) => (r && typeof r === 'object' ? (r.value ?? '') : (r ?? ''));
const isWeekly = (occurence) => String(occurence ?? '').trim().toLowerCase() === 'weekly';
export const remarkOptions = (occurence) => {
    const lists = isWeekly(occurence) ? [LOR_WEEKLY_REMARKS, LOR_ONLY_WEEKLY_RELOAN_OFFSET_REMARKS] : [LOR_DAILY_REMARKS, LOR_ONLY_DAILY_RELOAN_OFFSET_REMARKS];
    const seen = new Set();
    const all = lists.flat().filter((r) => r.value !== '' && !seen.has(r.value) && seen.add(r.value));
    // register-only extras are listed next to the remarks they belong with, not at the bottom
    const anchor = { 'reloaner-wd': 'reloaner-cont', 'offset-delinquent': 'offset-good' };
    const main = all.filter((r) => !anchor[r.value]);
    for (const extra of all.filter((r) => anchor[r.value])) {
        const at = main.findIndex((r) => r.value === anchor[extra.value]);
        main.splice(at >= 0 ? at + 1 : main.length, 0, extra);
    }
    return main;
};
export const canonicalRemark = (value) => {
    const v = remarkValue(value);
    if (v === '') return '';
    const hit = [LOR_DAILY_REMARKS, LOR_WEEKLY_REMARKS, LOR_ONLY_DAILY_RELOAN_OFFSET_REMARKS, LOR_ONLY_WEEKLY_RELOAN_OFFSET_REMARKS].flat().find((r) => r.value === v);
    return hit ? { label: hit.label, value: hit.value } : { label: String(v), value: String(v) };
};

// ── value normalisation / comparison ───────────────────────────────────────────
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const toNum = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

export function normalizeValue(def, value) {
    if (value === undefined) return undefined;
    if (def.type === 'remarks') return canonicalRemark(value);
    if (value === null || value === '') return def.nullable || def.type === 'text' ? (def.nullable ? null : '') : null;
    switch (def.type) {
        case 'money': return round2(value);
        case 'int':   return Number(value);
        case 'bool':  return value === true || value === 'true';
        case 'date':  return String(value).slice(0, 10);
        default:      return String(value);
    }
}

export function sameValue(def, a, b) {
    if (def.type === 'remarks') return remarkValue(a) === remarkValue(b);
    const x = a === undefined || a === '' ? null : a;
    const y = b === undefined || b === '' ? null : b;
    if (x === null || y === null) return x === y;
    if (def.type === 'money') return Math.abs(Number(x) - Number(y)) < 0.005;
    if (def.type === 'int')   return Number(x) === Number(y);
    if (def.type === 'bool')  return (x === true || x === 'true') === (y === true || y === 'true');
    if (def.type === 'date')  return String(x).slice(0, 10) === String(y).slice(0, 10);
    return String(x) === String(y);
}

/** [{ field, before, after }] for fields whose value actually changed. */
export function diffFields(entity, before, proposed) {
    const defs = ENTITIES[entity].fields;
    const out = [];
    for (const [field, raw] of Object.entries(proposed ?? {})) {
        const def = defs[field];
        if (!def) continue;
        const after = normalizeValue(def, raw);
        if (after === undefined) continue;
        if (!sameValue(def, before?.[field], after)) {
            out.push({ field, before: before?.[field] ?? null, after });
        }
    }
    return out;
}
