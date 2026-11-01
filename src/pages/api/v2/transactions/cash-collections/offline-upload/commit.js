/**
 * src/pages/api/v2/transactions/cash-collections/offline-upload/commit.js
 *
 * Writes the rows of an offline-collection template into cashCollections as DRAFTS.
 *
 *  - NEVER touches loans, clients, groups or denominations (that only happens when the
 *    draft is finalized on the LOR page through saveV2).
 *  - Always posts to the system date (getSystemDate), never a date sent by the client.
 *  - Everything (row writes + upload record + per-row audit) goes in ONE graph.mutation,
 *    so it is all-or-nothing.
 *  - The derived figures (loanBalance, mispayment, mcbu...) are computed by the LOR page logic in
 *    the browser, same trust model as saveV2. This endpoint re-validates scope, state and baseline,
 *    and bounds the values, it does not recompute them.
 *
 * Returns HTTP 200 with success:false for business rejections (a 403 would log the user out).
 */

import moment from 'moment-timezone';
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { CASH_COLLECTIONS_FIELDS, HOLIDAY_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { findBranches, findGroups, findUserById } from '@/lib/graph.functions';
import { getSystemDate } from '@/lib/date-utils';
import { generateUUID, safeNumber } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { LOR_DAILY_REMARKS, LOR_WEEKLY_REMARKS, NON_MISPAY_REMARKS } from '@/lib/constants';
import { resolveMispayment } from '@/lib/mispayment-utils';
import { canUseOfflineUpload, canAccessGroupForUpload } from '@/lib/offline-upload/permissions';
import { UPLOAD_BLOCKED_REMARKS } from '@/lib/offline-upload/lor-row-engine';
import logger from '@/logger';

const TIMEZONE = 'Asia/Manila';
const MAX_ROWS = 200;

const graph = new GraphProvider();
const CC_TYPE = createGraphType('cashCollections', CASH_COLLECTIONS_FIELDS);
const CC_ID_TYPE = createGraphType('cashCollections', '_id');
const LOAN_TYPE = createGraphType('loans', LOAN_FIELDS);
const UPLOAD_TYPE = createGraphType('cash_collection_uploads', '_id');
const UPLOAD_ROW_TYPE = createGraphType('cash_collection_upload_rows', '_id');
// same shape qr-cash-collection/submit.js uses for its holiday lookup: date is stored as 'MM-DD'
const HOLIDAY_TYPE = createGraphType('holidays', HOLIDAY_FIELDS);
const TX_SETTINGS_TYPE = createGraphType('transactionSettings', 'allowWeekendTransaction');


const CC_FIELD_SET = new Set(
    CASH_COLLECTIONS_FIELDS.split('\n').map(f => f.trim()).filter(Boolean)
);

// Fields the server decides. Whatever the client sends for these is ignored.
const SERVER_OWNED = new Set([
    '_id', 'groupStatus', 'origin', 'draft', 'dateAdded', 'dateModified', 'timeAdded', 'closingTime',
    'insertedBy', 'insertedByName', 'insertedDateTime',
    'modifiedBy', 'modifiedByName', 'modifiedDateTime',
    'branchId', 'groupId', 'groupName', 'loId', 'clientId', 'loanId', 'slotNo', 'loanCycle', 'fullName',
    'loanTerms', 'coMaker', 'status', 'fullPaymentDate', 'closedDate',
    'reverted', 'revertedDate', 'bmRevertCount', 'uploadBatchId',
    // fee / release columns belong to release rows, never to an upload row
    'admissionCollection', 'lrfCollection', 'cbhbCollection', 'addHospitalization',
    'otherPassbookCollection', 'otherPictureCollection', 'otherIncome', 'currentReleaseAmount',
    // withdrawals go through mcbu_withdrawals + approval, not through an upload
    'mcbuWithdrawal', 'csfWithdrawal',
]);

const NUMERIC_FIELDS = [
    'paymentCollection', 'mcbuCol', 'csfCollection', 'csfIn', 'mcbuReturnAmt', 'csfReturnAmt',
    'loanBalance', 'amountRelease', 'excess', 'pastDue', 'total', 'fullPayment', 'activeLoan',
    'targetCollection', 'mcbu', 'csf', 'advanceDays', 'noMispayment', 'noPastDue', 'maturedPastDue',
];

export default apiHandler({ post: commit });

const reply = (res, success, message, extra = {}) =>
    res.status(200).json({ success, error: !success, message, ...extra });

const near = (a, b, tol = 0.005) => Math.abs(safeNumber(a) - safeNumber(b)) < tol;

async function commit(req, res) {
    const userId = req?.auth?.sub;
    const user = await findUserById(userId);
    const body = req.body || {};

    const { groupId, rows, fileHash, fileName, templateVersion, templateDate, templateLoanIds } = body;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const replaceManualDrafts = body.replaceManualDrafts === true;

    const audit = (extra) => logAudit(req, {
        category: 'CASH_COLLECTION',   // match whichever category value your audit log uses
        entityType: 'cash_collection_upload',
        ...extra,
    }).catch(err => logger.error({ user_id: userId, page: 'LOR offline upload', message: 'audit failed', error: err.message }));

    try {
        // ---- 1. basic payload shape ------------------------------------------------------
        if (!groupId || typeof groupId !== 'string') return reply(res, false, 'groupId is required.');
        if (!Array.isArray(rows) || rows.length === 0) return reply(res, false, 'No rows to upload.');
        if (rows.length > MAX_ROWS) return reply(res, false, `Too many rows (max ${MAX_ROWS}).`);
        if (!/^[a-f0-9]{64}$/.test(fileHash || '')) return reply(res, false, 'Invalid file hash.');
        if (reason.length < 5 || reason.length > 500) return reply(res, false, 'Please enter the reason this collection was done offline (5-500 characters).');
        if (!Array.isArray(templateLoanIds)) return reply(res, false, 'Template metadata is missing.');

        // ---- 2. permission + scope (server is the source of truth) --------------------------
        if (!canUseOfflineUpload(user)) {
            await audit({ action: 'LOR_OFFLINE_UPLOAD_DENIED', severity: 'WARNING', success: false, failReason: 'role not allowed', description: `Offline upload denied (role) for group ${groupId}` });
            return reply(res, false, 'You are not allowed to upload offline collections.');
        }

        const [group] = await findGroups({ _id: { _eq: groupId } });
        if (!group) return reply(res, false, 'Group not found.');

        if (!canAccessGroupForUpload(user, group)) {
            await audit({ action: 'LOR_OFFLINE_UPLOAD_DENIED', severity: 'WARNING', success: false, failReason: 'out of scope', description: `Offline upload denied (scope) for group ${group.name}`, branchId: group.branchId });
            return reply(res, false, 'This group is outside your scope.');
        }

        // ---- 3. date: always the system date; the template must be for today -----------------
        const today = moment(getSystemDate()).tz(TIMEZONE).format('YYYY-MM-DD');
        if (templateDate !== today) {
            return reply(res, false, `This template is for ${templateDate}, but today is ${today}. Download a new template.`, { errorCode: 'TEMPLATE_STALE' });
        }

        if (group.occurence === 'weekly' && moment(today).format('dddd').toLowerCase() !== String(group.day).toLowerCase()) {
            return reply(res, false, 'This weekly group does not meet today.');
        }

        // weekend / holiday: the LOR pages disable every input on these days, so the server must too
        const [txSettings] = await graph.query(queryQl(TX_SETTINGS_TYPE('tx_settings'), { limit: 1 }))
            .then(r => r.data?.tx_settings ?? []);
        const isWeekendToday = [0, 6].includes(moment(today).day());
        if (isWeekendToday && txSettings?.allowWeekendTransaction !== true) {
            return reply(res, false, 'Collections are not allowed on weekends.');
        }
        const holidays = await graph.query(queryQl(HOLIDAY_TYPE('upload_holidays'), {})).then(r => r.data?.upload_holidays ?? []);
        if (holidays.some(h => h.date === moment(today).format('MM-DD'))) {
            return reply(res, false, 'Collections are not allowed on holidays.');
        }

        const [branch] = await findBranches({ _id: { _eq: group.branchId } });
        if (branch?.lockTransaction && !process.env.NEXT_PUBLIC_STAGING) {
            return reply(res, false, 'Transactions are locked for this branch.');
        }

        // ---- 4. existing rows of the group for today -----------------------------------------
        const existingRows = await graph.query(
            queryQl(CC_TYPE('existing_cc'), { where: { groupId: { _eq: group._id }, dateAdded: { _eq: today } } })
        ).then(r => r.data?.existing_cc ?? []);

        if (existingRows.some(r => r.groupStatus === 'closed')) {
            return reply(res, false, 'The Group Summary is already closed for today. Nothing can be uploaded.');
        }

        // ---- 5. same file already fully applied? ----------------------------------------------
        const prior = await graph.query(
            queryQl(UPLOAD_TYPE('prior_uploads'), {
                where: {
                    group_id: { _eq: group._id }, date_added: { _eq: today },
                    file_hash: { _eq: fileHash }, skipped_count: { _eq: 0 }, status: { _eq: 'applied' },
                },
                limit: 1,
            })
        ).then(r => r.data?.prior_uploads ?? []);
        if (prior.length > 0) {
            return reply(res, false, 'This exact file was already uploaded and fully applied today.');
        }

        // ---- 6. completeness: the upload must cover every row the template had ----------------
        // (finalize on the LOR page narrows the save to the draft clients, so a partial upload
        //  would silently leave the other clients out)
        const rowLoanIds = rows.map(r => r?.loanId);
        const sameSet = rowLoanIds.length === templateLoanIds.length
            && new Set(rowLoanIds).size === rowLoanIds.length
            && templateLoanIds.every(id => rowLoanIds.includes(id));
        if (!sameSet) {
            return reply(res, false, 'The uploaded rows do not match the template that was downloaded (rows were added or removed).', { errorCode: 'ROWS_MISMATCH' });
        }

        // ---- 7. loans for baseline validation ---------------------------------------------------
        const loans = await graph.query(
            queryQl(LOAN_TYPE('upload_loans'), { where: { _id: { _in: rowLoanIds } } })
        ).then(r => r.data?.upload_loans ?? []);
        const loanById = new Map(loans.map(l => [l._id, l]));
        const existingByLoan = new Map(existingRows.map(r => [r.loanId, r]));
        const remarksList = group.occurence === 'weekly' ? LOR_WEEKLY_REMARKS : LOR_DAILY_REMARKS;

        // ---- 8. classify + validate each row ---------------------------------------------------
        const uploadId = generateUUID();
        const now = new Date();
        const actorName = `${user.firstName} ${user.lastName}`;
        const inserts = [];
        const updates = [];
        const rowAudit = [];
        const skipped = [];
        const totals = { paymentCollection: 0, mcbuCol: 0, csfCollection: 0 };

        for (const item of rows) {
            const row = item.row || {};
            const loan = loanById.get(item.loanId);
            const existing = existingByLoan.get(item.loanId);

            const skip = (why) => {
                skipped.push({ slotNo: loan?.slotNo ?? item.slotNo, loanId: item.loanId, reason: why });
                rowAudit.push({
                    _id: generateUUID(), upload_id: uploadId, cash_collection_id: existing?._id ?? null,
                    loan_id: item.loanId, client_id: loan?.clientId ?? item.clientId ?? null,
                    slot_no: loan?.slotNo ?? null, action: 'skipped', skip_reason: why,
                });
            };

            const rowError = validateRow({ row, loan, group, remarksList });
            if (rowError) { skip(rowError); continue; }

            const verdict = classifyExisting(existing, replaceManualDrafts);
            if (verdict.skip) { skip(verdict.skip); continue; }

            const record = buildRecord({ row, loan, group, today, uploadId, user, actorName, now });

            totals.paymentCollection += record.paymentCollection;
            totals.mcbuCol += record.mcbuCol;
            totals.csfCollection += record.csfCollection;

            if (existing) {
                updates.push({ id: existing._id, set: { ...record, modifiedBy: user._id, modifiedByName: actorName, modifiedDateTime: now } });
                rowAudit.push({
                    _id: generateUUID(), upload_id: uploadId, cash_collection_id: existing._id,
                    loan_id: loan._id, client_id: loan.clientId, slot_no: loan.slotNo,
                    action: 'updated', skip_reason: verdict.replaces ? `replaced ${verdict.replaces} draft` : null,
                    before_data: existing, after_data: record,
                });
            } else {
                const _id = generateUUID();
                inserts.push({ ...record, _id, insertedBy: user._id, insertedByName: actorName, insertedDateTime: now, bmRevertCount: loan.bmRevertCount || 0 });
                rowAudit.push({
                    _id: generateUUID(), upload_id: uploadId, cash_collection_id: _id,
                    loan_id: loan._id, client_id: loan.clientId, slot_no: loan.slotNo,
                    action: 'inserted', after_data: record,
                });
            }
        }

        const appliedCount = inserts.length + updates.length;

        // ---- 9. one atomic write -----------------------------------------------------------------
        const mutationList = [];
        const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

        if (inserts.length > 0) {
            addToMutationList(alias => insertQl(CC_ID_TYPE(alias), { objects: inserts }));
        }
        updates.forEach(u => {
            addToMutationList(alias => updateQl(CC_ID_TYPE(alias), { set: u.set, where: { _id: { _eq: u.id } } }));
        });

        // the upload record must come before its rows (foreign key); mutation fields run in order
        addToMutationList(alias => insertQl(UPLOAD_TYPE(alias), {
            objects: [{
                _id: uploadId, group_id: group._id, branch_id: group.branchId, lo_id: group.loanOfficerId ?? null,
                occurence: group.occurence, date_added: today,
                uploaded_by: user._id, uploaded_by_name: actorName, uploaded_at: now,
                file_name: typeof fileName === 'string' ? fileName.slice(0, 200) : null,
                file_hash: fileHash, template_version: templateVersion ?? null, reason,
                row_count: rows.length, applied_count: appliedCount, skipped_count: skipped.length,
                status: appliedCount > 0 ? 'applied' : 'nothing_applied', totals,
            }],
        }));
        addToMutationList(alias => insertQl(UPLOAD_ROW_TYPE(alias), { objects: rowAudit }));

        await graph.mutation(...mutationList);

        await audit({
            action: appliedCount > 0 ? 'LOR_OFFLINE_UPLOAD_APPLIED' : 'LOR_OFFLINE_UPLOAD_NOTHING_APPLIED',
            severity: skipped.length > 0 ? 'WARNING' : 'INFO',
            entityId: uploadId,
            success: true,
            description: `Offline upload for group "${group.name}" (${today}): ${appliedCount} applied, ${skipped.length} skipped. Reason: ${reason}`,
            afterData: { uploadId, appliedCount, skippedCount: skipped.length, totals, fileHash },
            branchId: group.branchId,
            branchName: group.branchName,
        });

        const message = appliedCount > 0
            ? `${appliedCount} row(s) saved as draft${skipped.length ? `, ${skipped.length} skipped` : ''}.`
            : 'Nothing was saved: every row was skipped.';
        return reply(res, appliedCount > 0, message, {
            uploadId, appliedCount, skippedCount: skipped.length, skipped,
        });
    } catch (error) {
        logger.error({ user_id: userId, page: 'LOR offline upload commit', message: error.message, stack: error.stack });
        await audit({ action: 'LOR_OFFLINE_UPLOAD_FAILED', severity: 'ERROR', success: false, failReason: error.message, description: `Offline upload failed for group ${groupId}` });
        return res.status(500).json({ success: false, error: true, message: 'Upload failed. Nothing was saved. Please try again.' });
    }
}

// ----------------------------------------------------------------------------------------------
// What may we write over?
//   no row                      -> insert (daily, or weekly rows that were never pre-saved)
//   pre-save placeholder        -> update in place, origin becomes 'offline'
//   draft from a previous upload-> replace (before-image kept in the audit rows)
//   draft typed on the LOR page -> skip unless the user ticked "replace manual drafts"
//   submitted / reverted / auto -> skip and report
// ----------------------------------------------------------------------------------------------
function classifyExisting(existing, replaceManualDrafts) {
    if (!existing) return {};
    if (existing.reverted === true) return { skip: 'Row was reverted. Process it online.' };
    if (existing.draft === true) {
        if (existing.origin === 'offline') return { replaces: 'offline' };
        return replaceManualDrafts
            ? { replaces: 'manual' }
            : { skip: 'A draft saved from the LOR page already exists. Tick "replace manual drafts" to overwrite it.' };
    }
    if (existing.origin === 'pre-save') return {};
    return { skip: 'Already submitted. This row is final.' };
}

function validateRow({ row, loan, group, remarksList }) {
    if (!loan) return 'Loan not found.';
    if (loan.groupId !== group._id) return 'Loan does not belong to this group.';
    if (loan.status !== 'active') return 'Loan is not active. Process this row online.';
    if (loan.occurence && loan.occurence !== group.occurence) return 'Loan occurrence does not match the group.';
    if (loan.maturedPD) return 'Matured past due loan. Process this row online.';

    // numbers
    for (const f of NUMERIC_FIELDS) {
        if (row[f] === undefined || row[f] === null || row[f] === '' || row[f] === '-') continue;
        const n = Number(row[f]);
        if (!Number.isFinite(n) || n < 0 || n > 10000000) return `Invalid value for ${f}.`;
    }

    // baseline: the figures the browser computed from must still be the loan's figures
    const prev = row.prevData;
    if (!prev || typeof prev !== 'object') return 'Row has no baseline (prevData). Download a fresh template.';
    for (const key of ['loanBalance', 'noOfPayments', 'mcbu', 'amountRelease', 'csf']) {
        if (prev[key] === undefined || prev[key] === null) {
            if (['loanBalance', 'noOfPayments', 'mcbu'].includes(key)) return `Baseline is missing ${key}. Download a fresh template.`;
            continue;
        }
        if (!near(prev[key], loan[key])) return `Loan changed since the template was downloaded (${key}). Download a fresh template.`;
    }

    // ranges
    const payment = safeNumber(row.paymentCollection);
    if (payment > safeNumber(loan.loanBalance) + 0.005) return 'Payment is greater than the loan balance.';
    if (safeNumber(row.loanBalance) > safeNumber(loan.loanBalance) + 0.005) return 'Resulting loan balance is higher than the current balance.';

    // remarks must be a known value; offsets need a close remark and exact return amounts
    const remarksValue = row.remarks && typeof row.remarks === 'object' ? row.remarks.value : null;
    if (row.remarks && !remarksValue) return 'Invalid remarks.';
    if (remarksValue) {
        if (UPLOAD_BLOCKED_REMARKS.includes(remarksValue)) return 'This remark must be processed online.';
        if (!remarksList.some(r => r.value === remarksValue)) return 'Unknown remarks for this group type.';
    }

    const isOffset = !!remarksValue && remarksValue.startsWith('offset');
    if (isOffset) {
        if (typeof row.closeRemarks !== 'string' || row.closeRemarks.trim().length < 3) return 'Offset needs close-account remarks.';
        const expectedReturn = safeNumber(loan.mcbu) + safeNumber(loan.csf);
        if (!near(row.mcbuReturnAmt, expectedReturn, 0.01)) return 'MCBU/CSF return amount does not match the client balance.';
    } else if (safeNumber(row.mcbuReturnAmt) !== 0 || safeNumber(row.csfReturnAmt) !== 0) {
        return 'Return amount is only valid on offset rows.';
    }

    // withdrawals are not uploadable in v1. mcbuWithdrawal / csfWithdrawal are server-owned and always
    // written as 0: a pending withdrawal request is re-attached by the LOR page when the draft loads,
    // exactly like it is for a draft typed online, so a non-zero value coming from the page is not an error.

    return null;
}

function buildRecord({ row, loan, group, today, uploadId, user, actorName, now }) {
    const record = {};
    for (const [k, v] of Object.entries(row)) {
        if (CC_FIELD_SET.has(k) && !SERVER_OWNED.has(k)) record[k] = v;
    }

    NUMERIC_FIELDS.forEach(f => { if (f in record) record[f] = safeNumber(record[f]); });

    // canonical remarks object from the list, so a tampered label can never be stored
    const remarksValue = row.remarks && typeof row.remarks === 'object' ? row.remarks.value : null;
    if (remarksValue) {
        const canonical = (group.occurence === 'weekly' ? LOR_WEEKLY_REMARKS : LOR_DAILY_REMARKS).find(r => r.value === remarksValue);
        record.remarks = canonical ? { label: canonical.label, value: canonical.value } : row.remarks;
    } else {
        record.remarks = '';
    }
    if (typeof row.closeRemarks === 'string' && remarksValue?.startsWith('offset')) {
        record.closeRemarks = row.closeRemarks.trim();
    }

    record.mispayment = resolveMispayment({ ...row, ...record });
    if (NON_MISPAY_REMARKS.includes(remarksValue)) record.mispayment = false;

    return {
        ...record,
        noOfPayments: Number(record.noOfPayments) || 0,
        loanTerms: `${loan.loanTerms}`,
        coMaker: loan.coMaker == null || loan.coMaker === '-' ? null : `${loan.coMaker}`,
        // identity always comes from the DB
        loanId: loan._id, clientId: loan.clientId, slotNo: loan.slotNo, loanCycle: loan.loanCycle,
        fullName: loan.fullName,
        branchId: group.branchId, groupId: group._id, groupName: group.name,
        loId: group.loanOfficerId ?? loan.loId,
        // the whole point of the upload
        status: 'active',
        fullPaymentDate: null,   // set when the draft is finalized on the LOR page
        draft: true,
        origin: 'offline',
        groupStatus: 'pending',
        dateAdded: today,
        uploadBatchId: uploadId,
        // fees and release amounts are never part of an active-row upload
        admissionCollection: 0, lrfCollection: 0, cbhbCollection: 0, addHospitalization: 0,
        otherPassbookCollection: 0, otherPictureCollection: 0, otherIncome: 0, currentReleaseAmount: 0,
        mcbuWithdrawal: 0, csfWithdrawal: 0,
    };
}