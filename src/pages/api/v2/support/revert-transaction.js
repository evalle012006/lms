// src/pages/api/v2/support/revert-transaction.js
// POST { cashCollectionId, reason, ticketRef?, confirmed? }
// Reverts a collection exactly like the LOR "revert" (rollback-transaction: restores the loan from its history
// snapshot, deletes the row, un-closes the client/slot...), with the same safety rules, but for support:
//  - the group status (e.g. a closed group transaction) is disregarded: support may revert a row in a closed group;
//  - support is not a branch manager, so the one-time BM limit never blocks it and bmRevertCount is NOT incremented;
//  - the row is loaded from the database, never taken from the browser;
//  - a reason is required and a support_edits trail row is written.
// The revert restores the LATEST loan snapshot, so it is only allowed on the loan's newest saved row.
import { apiHandler } from '@/services/api-handler';
import { createGraphType, queryQl, insertQl } from '@/lib/graph/graph.util';
import { CASH_COLLECTIONS_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import { MIN_REASON_LENGTH, getShortCode } from '@/lib/support-edit-config';
import { requireSupportUser, fail, graph } from '@/lib/support-edit-service';
import { revert as rollbackTransaction } from '@/pages/api/v2/transactions/cash-collections/rollback-transaction';
import { logAudit } from '@/lib/audit';
import moment from 'moment-timezone';

const CC_TYPE = createGraphType('cashCollections', CASH_COLLECTIONS_FIELDS);
const NEWER_TYPE = createGraphType('cashCollections', '_id dateAdded draft status');
const EDIT_INSERT = createGraphType('support_edits', '_id')('edit_insert');

export default apiHandler({ post: revertTransaction });

// minimal response shim so the existing handler can be reused unchanged
function capture() {
    const out = { status: 200, body: null };
    const res = {
        status(c) { out.status = c; return res; },
        setHeader() { return res; },
        json(b) { out.body = b; return res; },
        send(b) { out.body = b; return res; },
        end(b) { try { out.body = typeof b === 'string' ? JSON.parse(b) : b; } catch (e) { out.body = { success: false, message: String(b) }; } return res; },
    };
    return { res, out };
}

async function revertTransaction(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;

    const { cashCollectionId, ticketRef } = req.body ?? {};
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const confirmed = req.body?.confirmed === true;
    if (reason.length < MIN_REASON_LENGTH) return fail(res, `A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
    if (typeof cashCollectionId !== 'string' || !cashCollectionId) return fail(res, 'cashCollectionId is required.');
    if (ticketRef != null && (typeof ticketRef !== 'string' || ticketRef.length > 100)) return fail(res, 'Ticket reference is invalid.');

    const [row] = await graph.query(queryQl(CC_TYPE('cc'), { where: { _id: { _eq: cashCollectionId } }, limit: 1 })).then((r) => r.data?.cc ?? []);
    if (!row) return fail(res, 'Collection not found (already reverted?).');
    if (row.draft === true) return fail(res, 'This is a draft: it never changed the loan, so there is nothing to revert.');

    const newer = await graph.query(queryQl(NEWER_TYPE('newer'), {
        where: { loanId: { _eq: row.loanId }, draft: { _neq: true }, dateAdded: { _gt: row.dateAdded } }, limit: 1,
    })).then((r) => r.data?.newer ?? []);
    if (newer.length) return fail(res, `Only the loan's latest collection can be reverted (there is a newer one on ${String(newer[0].dateAdded).slice(0, 10)}). Revert that one first, or correct this row with the editor.`);

    // same handler the LOR uses, called as this support user
    const inner = Object.create(req, { supportIgnoreGroupStatus: { value: true }, body: { value: [row] }, query: { value: { confirmed: confirmed ? 'true' : 'false' } } });
    const { res: shim, out } = capture();
    await rollbackTransaction(inner, shim);
    const body = out.body ?? { success: false, message: 'Revert returned no result.' };
    if (!body.success) return res.status(200).json({ ...body, success: false, message: body.message || body.error || 'Revert failed.' });

    const actorName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    const editId = generateUUID();
    try {
        await graph.mutation(insertQl(EDIT_INSERT, { objects: [{
            _id: editId, edited_at: moment().toISOString(), user_id: user._id, user_name: actorName,
            entity_type: 'cashCollections', entity_id: row._id, client_id: row.clientId, loan_id: row.loanId, branch_id: row.branchId ?? null,
            reason, ticket_ref: ticketRef?.trim() || null,
            changes: [{ field: '(transaction reverted)', before: String(row.dateAdded).slice(0, 10), after: null }],
            before_data: row, after_data: {}, warnings: null,
            ip_address: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || null,
        }] }));
    } catch (e) { /* the revert itself already succeeded and is audited by the LOR handler */ }
    await logAudit(req, {
        action: 'SUPPORT_TRANSACTION_REVERTED', category: 'SUPPORT', severity: 'WARNING', entityType: 'cashCollections', entityId: row._id,
        clientId: row.clientId, branchId: row.branchId, userId: user._id, userName: actorName,
        description: `${actorName} (${getShortCode(user)}) reverted the ${String(row.dateAdded).slice(0, 10)} collection of loan ${row.loanId}. Reason: ${reason}`,
        metadata: { supportEditId: editId, loanId: row.loanId, ticketRef: ticketRef || null },
    }).catch(() => {});
    return res.status(200).json({ success: true, editId, skipped: body.skipped ?? [] });
}
