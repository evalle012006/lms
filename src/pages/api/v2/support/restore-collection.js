// src/pages/api/v2/support/restore-collection.js
// POST { loanId, date: 'YYYY-MM-DD', reason, ticketRef? }
// Re-creates a MISSING cashCollections row with 0 amounts. Neither shape touches the loan.
//  - system date  -> exactly what pre-save would have created (origin 'pre-save', not a draft), so the LOR page treats it
//                    like any pre-save row (it re-opens a submitted register, saveV2 clears the origin on save).
//  - earlier date -> a DRAFT (origin 'support-restore'); the LOR page cannot open past dates, so support fills it in
//                    and finalizes it in the editor (normal edit flow: validation + audit trail).
// The id is the same deterministic id pre-save uses, so a concurrent pre-save can never create a second row for
// the loan and date: whichever runs second hits the primary key and is a harmless no-op / clean error.
import { apiHandler } from '@/services/api-handler';
import moment from 'moment-timezone';
import { createGraphType, queryQl, insertQl } from '@/lib/graph/graph.util';
import { CASH_COLLECTIONS_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { findGroups } from '@/lib/graph.functions';
import { generateUUID } from '@/lib/utils';
import { presaveId } from '@/lib/presave-id';
import { resolveWeeklyMcbuMinimum } from '@/lib/mcbu-target-utils';
import { getWeeklyMcbuTargetConfig } from '@/lib/mcbu-withdrawal-utils';
import { getSystemDate } from '@/lib/date-utils';
import { logAudit } from '@/lib/audit';
import { MIN_REASON_LENGTH, getShortCode } from '@/lib/support-edit-config';
import { requireSupportUser, fail, graph } from '@/lib/support-edit-service';

const LOAN_TYPE = createGraphType('loans', LOAN_FIELDS)('loan');
const CC_TYPE = createGraphType('cashCollections', '_id dateAdded draft status paymentCollection')('existing');
const CC_INSERT = createGraphType('cashCollections', '_id')('restored');
const EDIT_INSERT = createGraphType('support_edits', '_id')('edit_insert');

export default apiHandler({ post: restore });

async function restore(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;

    const { loanId, date, ticketRef } = req.body ?? {};
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < MIN_REASON_LENGTH) return fail(res, `A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
    if (typeof loanId !== 'string' || !loanId) return fail(res, 'Loan is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !moment(date, 'YYYY-MM-DD', true).isValid()) return fail(res, 'Date must be YYYY-MM-DD.');
    if (ticketRef != null && (typeof ticketRef !== 'string' || ticketRef.length > 100)) return fail(res, 'Ticket reference is invalid.');

    const today = moment(getSystemDate()).tz('Asia/Manila').format('YYYY-MM-DD'); // staging-aware, same as saveV2 / commit
    if (date > today) return fail(res, 'A collection cannot be restored for a future date.');

    const data = await graph.query(
        queryQl(LOAN_TYPE, { where: { _id: { _eq: loanId } }, limit: 1 }),
        queryQl(CC_TYPE, { where: { loanId: { _eq: loanId }, dateAdded: { _eq: date } }, limit: 1 })
    ).then((r) => r.data ?? {});
    const loan = data.loan?.[0];
    if (!loan) return fail(res, 'Loan not found.');
    if (loan.status === 'pending') return fail(res, 'A pending loan has no collections to restore.');
    const existing = data.existing?.[0];
    if (existing) return fail(res, 'A collection already exists for this loan on that date. Open it instead.', { existingId: existing._id });

    const start = loan.dateGranted || loan.startDate;
    if (start && date < moment(start).format('YYYY-MM-DD')) return fail(res, `The date is before the loan started (${moment(start).format('YYYY-MM-DD')}).`);
    const end = loan.fullPaymentDate || loan.closedDate;
    if (end && date > moment(end).format('YYYY-MM-DD')) return fail(res, `The date is after the loan was closed (${moment(end).format('YYYY-MM-DD')}).`);

    const group = (await findGroups({ _id: { _eq: loan.groupId } }))?.[0];
    if (!group) return fail(res, 'The loan\'s group was not found.');

    const actorName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    const now = moment().toISOString();
    const _id = presaveId(String(loan._id), date);
    const isToday = date === today;
    const mcbuTarget = group.occurence === 'weekly' ? resolveWeeklyMcbuMinimum(await getWeeklyMcbuTargetConfig(), group.weeklyScheduleType) : (Number(loan.mcbuTarget) || 0);
    const record = {
        _id, loanId: loan._id, clientId: loan.clientId, slotNo: loan.slotNo, loanCycle: loan.loanCycle,
        fullName: loan.fullName, loanTerms: `${loan.loanTerms}`,
        coMaker: loan.coMaker == null || loan.coMaker === '-' ? null : `${loan.coMaker}`,
        branchId: group.branchId, groupId: group._id, groupName: group.name, loId: group.loanOfficerId ?? loan.loId,
        status: isToday ? loan.status : 'active', draft: !isToday, origin: isToday ? 'pre-save' : 'support-restore', groupStatus: 'pending', dateAdded: date,
        occurence: group.occurence, groupDay: group.day, mcbuTarget, total: 0, fullPayment: 0, noMispayment: loan.mispayment ?? 0,
        fullPaymentDate: null, remarks: '',
        paymentCollection: 0, mcbuCol: 0, csfCollection: 0, csfIn: 0, mcbuReturnAmt: 0, csfReturnAmt: 0, excess: 0,
        pastDue: Number(loan.pastDue) || 0, noPastDue: 0, mispayment: false, advanceDays: 0, noOfPayments: Number(loan.noOfPayments) || 0,
        // running balances are carried from the loan as it stands now; support corrects them when finalizing
        loanBalance: Number(loan.loanBalance) || 0, activeLoan: Number(loan.activeLoan) || 0, targetCollection: Number(loan.activeLoan) || 0,
        mcbu: Number(loan.mcbu) || 0, csf: Number(loan.csf) || 0, amountRelease: Number(loan.amountRelease) || 0,
        maturedPastDue: Number(loan.maturedPastDue) || 0, bmRevertCount: loan.bmRevertCount || 0,
        admissionCollection: 0, lrfCollection: 0, cbhbCollection: 0, addHospitalization: 0,
        otherPassbookCollection: 0, otherPictureCollection: 0, otherIncome: 0, currentReleaseAmount: 0,
        mcbuWithdrawal: 0, csfWithdrawal: 0,
        insertedBy: user._id, insertedByName: actorName, insertedDateTime: now,
    };
    const editId = generateUUID();
    const edit = {
        _id: editId, edited_at: now, user_id: user._id, user_name: actorName,
        entity_type: 'cashCollections', entity_id: _id, client_id: loan.clientId, loan_id: loan._id, branch_id: group.branchId,
        reason, ticket_ref: ticketRef?.trim() || null,
        changes: [{ field: isToday ? '(restored as pre-save row)' : '(restored as draft)', before: null, after: date }],
        before_data: {}, after_data: record, warnings: null,
        ip_address: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || null,
    };

    // one request == one transaction: the restored row and its trail commit together
    try {
        await graph.mutation(insertQl(CC_INSERT, { objects: [record] }), insertQl(EDIT_INSERT, { objects: [edit] }));
    } catch (e) {
        // same loan + date created meanwhile (pre-save or a save from the LOR page): nothing was written
        return fail(res, 'A collection for this loan and date was just created by someone else. Refresh and open it instead.');
    }

    await logAudit(req, {
        action: 'SUPPORT_COLLECTION_RESTORED', category: 'SUPPORT', severity: 'WARNING',
        entityType: 'cashCollections', entityId: _id, clientId: loan.clientId, branchId: group.branchId,
        description: `${actorName} (${getShortCode(user)}) restored a missing collection as draft for loan ${loan._id} on ${date}. Reason: ${reason}`,
        userId: user._id, userName: actorName, metadata: { supportEditId: editId, loanId: loan._id, date },
    }).catch(() => {});

    return res.status(200).json({ success: true, id: _id, editId });
}
