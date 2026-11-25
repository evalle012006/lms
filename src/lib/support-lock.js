// src/lib/support-lock.js  (server only)
// Group-level edit lock held by the support team while it repairs data. See migration 016.
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl, updateQl } from '@/lib/graph/graph.util';
import moment from 'moment-timezone';

const graph = new GraphProvider();
export const LOCK_MINUTES = 15;
const LOCK_TYPE = createGraphType('support_locks', 'group_id locked_by user_name reason locked_at expires_at');

const active = (l) => l && moment(l.expires_at).isAfter(moment());

export async function getGroupLock(groupId) {
    if (!groupId) return null;
    const rows = await graph.query(queryQl(LOCK_TYPE('lock'), { where: { group_id: { _eq: groupId } }, limit: 1 })).then((r) => r.data?.lock ?? []);
    return active(rows[0]) ? rows[0] : null;
}

/** For the normal save APIs. Returns a message when the group is locked by support, else null. Fails OPEN on any error. */
export async function groupLockMessage(groupId, userId) {
    try {
        const lock = await getGroupLock(groupId);
        if (!lock || lock.locked_by === userId) return null;
        return `This group is being repaired by support (${lock.user_name || 'support'}). Please try again in a few minutes.`;
    } catch (e) { return null; }
}

/** Take or renew the lock. Returns { ok, lock } or { ok:false, lock } when someone else holds it. */
export async function acquireGroupLock({ groupId, user, userName, reason }) {
    const current = await getGroupLock(groupId);
    if (current && current.locked_by !== user._id) return { ok: false, lock: current };
    const expires_at = moment().add(LOCK_MINUTES, 'minutes').toISOString();
    const row = { group_id: groupId, locked_by: user._id, user_name: userName, reason: reason || null, locked_at: moment().toISOString(), expires_at };
    const existing = await graph.query(queryQl(LOCK_TYPE('lock'), { where: { group_id: { _eq: groupId } }, limit: 1 })).then((r) => r.data?.lock ?? []);
    if (existing.length) await graph.mutation(updateQl(LOCK_TYPE('upd'), { set: row, where: { group_id: { _eq: groupId } } }));
    else await graph.mutation(insertQl(LOCK_TYPE('ins'), { objects: [row] }));
    return { ok: true, lock: row };
}

export async function releaseGroupLock({ groupId, userId }) {
    await graph.mutation(updateQl(LOCK_TYPE('rel'), { set: { expires_at: moment().subtract(1, 'minute').toISOString() }, where: { group_id: { _eq: groupId }, locked_by: { _eq: userId } } }));
}

// ── generic guard for the other write paths ─────────────────────────────────────────────────────────
// The save / revert / approve / transfer / withdrawal APIs name their records differently (groupId, group_id,
// loanId, clientId, ...). Collect whatever ids a request carries, resolve loans and clients to their group, and
// refuse when any of those groups is locked by someone else. One cheap query first: no active lock => nothing else runs.
const GROUP_KEYS = ['groupId', 'group_id', 'sourceGroupId', 'targetGroupId', 'oldGroupId', 'newGroupId'];
const LOAN_KEYS = ['loanId', 'loan_id'];
const CLIENT_KEYS = ['clientId', 'client_id'];
const ANY_LOCK_TYPE = createGraphType('support_locks', 'group_id locked_by user_name expires_at');
const LOAN_GROUP_TYPE = createGraphType('loans', '_id groupId');
const CLIENT_GROUP_TYPE = createGraphType('client', '_id groupId');

function collectIds(body, out = { groups: new Set(), loans: new Set(), clients: new Set() }, depth = 0) {
    if (!body || depth > 3) return out;
    if (Array.isArray(body)) { body.slice(0, 500).forEach((b) => collectIds(b, out, depth + 1)); return out; }
    if (typeof body !== 'object') return out;
    for (const [k, v] of Object.entries(body)) {
        if (typeof v === 'string' && v) {
            if (GROUP_KEYS.includes(k)) out.groups.add(v);
            else if (LOAN_KEYS.includes(k)) out.loans.add(v);
            else if (CLIENT_KEYS.includes(k)) out.clients.add(v);
        } else if (v && typeof v === 'object') collectIds(v, out, depth + 1);
    }
    return out;
}

/** Message when any group touched by this request is locked by another user, else null. Fails OPEN on any error. */
export async function lockMessageForBody(body, userId, extra = {}) {
    try {
        const locks = await graph.query(queryQl(ANY_LOCK_TYPE('locks'), { where: { expires_at: { _gt: moment().toISOString() }, locked_by: { _neq: userId } } })).then((r) => r.data?.locks ?? []);
        if (!locks.length) return null;
        const ids = collectIds(body);
        (extra.groupIds ?? []).forEach((g) => g && ids.groups.add(g));
        (extra.loanIds ?? []).forEach((g) => g && ids.loans.add(g));
        (extra.clientIds ?? []).forEach((g) => g && ids.clients.add(g));
        const [loans, clients] = await Promise.all([
            ids.loans.size ? graph.query(queryQl(LOAN_GROUP_TYPE('l'), { where: { _id: { _in: [...ids.loans] } } })).then((r) => r.data?.l ?? []) : [],
            ids.clients.size ? graph.query(queryQl(CLIENT_GROUP_TYPE('c'), { where: { _id: { _in: [...ids.clients] } } })).then((r) => r.data?.c ?? []) : [],
        ]);
        loans.forEach((l) => l.groupId && ids.groups.add(l.groupId));
        clients.forEach((c) => c.groupId && ids.groups.add(c.groupId));
        const hit = locks.find((l) => ids.groups.has(l.group_id));
        return hit ? `This group is being repaired by support (${hit.user_name || 'support'}). Please try again in a few minutes.` : null;
    } catch (e) { return null; }
}
