// src/lib/support-edit-service.js  (server only)
// Shared by the /api/v2/support/* endpoints: load -> diff -> validate -> apply (+ trail).

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { generateUUID } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import {
    ENTITIES, fetchFieldNames, diffFields, sameValue, normalizeValue,
    canUseSupportEditor, getShortCode, MIN_REASON_LENGTH,
} from '@/lib/support-edit-config';
import { validateEdit } from '@/lib/support-edit-validate';
import moment from 'moment-timezone';
import { getSystemDate } from '@/lib/date-utils';

const graph = new GraphProvider();

const typeFor = (entity, alias = 'rec') => createGraphType(ENTITIES[entity].table, fetchFieldNames(entity).join(' '))(alias);
const LOAN_CTX_TYPE   = createGraphType('loans', '_id clientId status ldfApproved mcbu csf loanBalance activeLoan amountRelease principalLoan maturedPastDue loanCycle maturedPD pastDue remarks')('ctx_loan');
const GROUP_CTX_TYPE  = createGraphType('groups', '_id occurence csfEnabled')('ctx_group');
const CLIENT_CTX_TYPE = createGraphType('client', '_id fullName status')('ctx_client');
const OPEN_LOANS_TYPE = createGraphType('loans', '_id')('open_loans');
const SETTINGS_TYPE   = createGraphType('transactionSettings', 'serviceChargeRate lrfRate')('txn_settings');
const EDIT_TYPE       = createGraphType('support_edits', `
    _id edited_at user_id user_name entity_type entity_id client_id loan_id branch_id reason ticket_ref changes warnings
`)('support_edits');
const EDIT_INSERT_TYPE = createGraphType('support_edits', '_id')('edit_insert');

export const fail = (res, message, extra = {}) => res.status(200).json({ success: false, message, ...extra }); // never 403 (client logs out)

/** Resolve + authorise the caller. Returns the user or sends the failure and returns null. */
export async function requireSupportUser(req, res) {
    const user = await findUserById(req.auth?.sub);
    if (!user) { fail(res, 'User not found.'); return null; }
    if (!canUseSupportEditor(user)) { fail(res, 'Only the support team can use the transaction editor.'); return null; }
    return user;
}

export async function loadRecord(entity, id) {
    const cfg = ENTITIES[entity];
    const rows = await graph.query(queryQl(typeFor(entity), { where: { [cfg.idField]: { _eq: id } }, limit: 1 })).then((r) => r.data?.rec ?? []);
    return rows[0] ?? null;
}

// Related rows used by the validator. Best effort: a missing relation only skips the rules that need it.
export async function loadContext(entity, row) {
    const clientId = entity === 'client' ? row._id : (row.clientId ?? row.client_id ?? null);
    const loanId   = entity === 'loans' ? row._id : (row.loanId ?? row.loan_id ?? null);
    const queries = [];
    if (loanId && entity !== 'loans') queries.push(queryQl(LOAN_CTX_TYPE, { where: { _id: { _eq: loanId } }, limit: 1 }));
    if (clientId && entity !== 'client') queries.push(queryQl(CLIENT_CTX_TYPE, { where: { _id: { _eq: clientId } }, limit: 1 }));
    const groupId = row.groupId ?? row.group_id ?? null;
    if (groupId && (entity === 'cashCollections' || entity === 'loans')) queries.push(queryQl(GROUP_CTX_TYPE, { where: { _id: { _eq: groupId } }, limit: 1 }));
    queries.push(queryQl(SETTINGS_TYPE, { limit: 1 }));
    if (clientId) queries.push(queryQl(OPEN_LOANS_TYPE, { where: { clientId: { _eq: clientId }, status: { _in: ['active', 'pending', 'completed'] } } }));
    const data = await graph.query(...queries).then((r) => r.data ?? {});
    return {
        loan: entity === 'loans' ? row : (data.ctx_loan?.[0] ?? null),
        client: data.ctx_client?.[0] ?? null,
        group: data.ctx_group?.[0] ?? null,
        openLoanCount: data.open_loans?.length ?? 0,
        clientId, loanId,
        serviceChargeRate: data.txn_settings?.[0]?.serviceChargeRate ?? null,
        lrfRate: data.txn_settings?.[0]?.lrfRate ?? null,
        today: moment.tz(getSystemDate(), 'Asia/Manila').format('YYYY-MM-DD'),
    };
}

/**
 * Pure-ish pipeline used by BOTH validate (dry run) and update (apply).
 * `proposed` = { field: newValue }  (unknown / non-editable fields are rejected, not ignored).
 */
export async function prepareEdit({ entity, id, proposed, expected }) {
    const cfg = ENTITIES[entity];
    if (!cfg) return { error: `Unknown record type "${entity}".` };
    if (typeof id !== 'string' || !id) return { error: 'Record id is required.' };
    if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)) return { error: 'No changes provided.' };

    const unknown = Object.keys(proposed).filter((f) => !cfg.fields[f]);
    if (unknown.length) return { error: `These fields cannot be edited here: ${unknown.join(', ')}.` };

    const before = await loadRecord(entity, id);
    if (!before) return { error: 'Record not found.' };

    // stale-screen guard: what the editor SAW for the fields they changed must still be what is in the DB
    if (expected && typeof expected === 'object') {
        const stale = Object.keys(proposed).filter((f) => f in expected && !sameValue(cfg.fields[f], before[f], expected[f]));
        if (stale.length) return { error: `${stale.join(', ')} changed since you opened this record. Reload it and try again.`, stale: true };
    }

    const changes = diffFields(entity, before, proposed);
    const ctx = await loadContext(entity, before);
    const validation = validateEdit({ entity, before, changes, ctx });
    return { before, changes, ctx, validation };
}

export async function applyEdit({ req, user, entity, id, prepared, reason, ticketRef, acknowledgedWarnings }) {
    const cfg = ENTITIES[entity];
    const { before, changes, ctx, validation } = prepared;
    const now = moment().toISOString();
    const actorName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

    const set = {};
    for (const c of changes) set[c.field] = normalizeValue(cfg.fields[c.field], c.after);
    // stamp the row the way the normal save paths do, so "last modified by" is truthful
    if (entity === 'loans' || entity === 'cashCollections') Object.assign(set, { modifiedBy: user._id, modifiedByName: actorName, modifiedDateTime: new Date() });
    if (entity === 'client') set.dateModified = now;
    if (entity === 'mcbu_withdrawals') Object.assign(set, { modified_by: user._id, modified_date: now });

    const after = { ...before, ...Object.fromEntries(changes.map((c) => [c.field, c.after])) };
    const editId = generateUUID();
    const row = {
        _id: editId, edited_at: now, user_id: user._id, user_name: actorName,
        entity_type: entity, entity_id: id,
        client_id: ctx.clientId, loan_id: ctx.loanId, branch_id: before.branchId ?? before.branch_id ?? null,
        reason, ticket_ref: ticketRef || null,
        changes, before_data: before, after_data: after,
        warnings: acknowledgedWarnings ? validation.warnings : null,
        ip_address: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || null,
    };

    // ONE GraphQL request == one Postgres transaction: the data change and its trail commit together or not at all.
    const result = await graph.mutation(
        updateQl(typeFor(entity, 'updated'), { set, where: { [cfg.idField]: { _eq: id } } }),
        insertQl(EDIT_INSERT_TYPE, { objects: [row] })
    ).then((r) => r.data);

    const affected = result?.updated?.affected_rows ?? result?.updated?.returning?.length ?? 0;
    if (!affected) throw new Error('Update affected no rows.');

    await logAudit(req, {
        action: 'SUPPORT_RECORD_EDITED', category: 'SUPPORT', severity: 'WARNING',
        entityType: entity, entityId: id, clientId: ctx.clientId,
        description: `${actorName} (${getShortCode(user)}) edited ${cfg.label.toLowerCase()} ${id}: ${changes.map((c) => c.field).join(', ')}. Reason: ${reason}`,
        branchId: row.branch_id, userId: user._id, userName: actorName,
        beforeData: Object.fromEntries(changes.map((c) => [c.field, c.before])),
        afterData: Object.fromEntries(changes.map((c) => [c.field, c.after])),
        metadata: { supportEditId: editId, reason, ticketRef: ticketRef || null, loanId: ctx.loanId, warnings: row.warnings },
    });

    return { editId, record: result.updated.returning?.[0] ?? null };
}

export { EDIT_TYPE, graph, MIN_REASON_LENGTH };
