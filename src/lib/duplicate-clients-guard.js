// src/lib/duplicate-clients-guard.js
// Save-time duplicate guard. Uses the same matching rules as the scan (lib/duplicate-clients.js)
// so "what the scan flags" and "what is blocked/flagged at entry" can never drift apart.
//
// Policy (decided with the product owner):
//   - exact / high match to a client that has an ACTIVE or PENDING loan  -> BLOCK  (admin/supervisor may override, audited)
//   - any other match                                                    -> WARN only
//
// Pure scoring lives in evaluateMatches(); findDuplicateMatches() adds the DB lookups around it.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { prepareClient, scorePair } from '@/lib/duplicate-clients';

const graph = new GraphProvider();

const CANDIDATE_TYPE = createGraphType('client', `
  _id firstName middleName lastName birthdate contactNumber
  address addressStreetNo addressBarangayDistrict addressMunicipalityCity
  branchId branchName groupId loId oldGroupId oldLoId status dateAdded
`)('clients');
const LOAN_TYPE = createGraphType('loans', `_id clientId status`)('loans');

const RANK = { exact: 3, high: 2, possible: 1 };
export const BLOCKING_CONFIDENCE = ['exact', 'high'];

export const isBlockingMatch = (m) =>
    BLOCKING_CONFIDENCE.includes(m.confidence) && (m.hasActiveLoan || m.hasPendingLoan);

/**
 * Pure. @param candidate  { firstName, middleName, lastName, birthdate, contactNumber, address*, branchId }
 *       @param existing   client rows
 *       @param loanState  { [clientId]: { active: bool, pending: bool } }
 */
export function evaluateMatches(candidate, existing, loanState = {}) {
    const c = prepareClient({ _id: '__candidate__', ...candidate });
    const out = [];
    for (const e of existing) {
        const res = scorePair(c, prepareClient(e));
        if (!res) continue;
        const l = loanState[e._id] ?? {};
        out.push({
            client: e,
            confidence: res.confidence,
            reasons: res.reasons,
            hasActiveLoan: !!l.active,
            hasPendingLoan: !!l.pending,
        });
    }
    return out.sort((a, b) =>
        RANK[b.confidence] - RANK[a.confidence] ||
        Number(b.hasActiveLoan) - Number(a.hasActiveLoan));
}

/** DB wrapper. Throws on query failure — callers decide whether that blocks (see callers: they fail open). */
export async function findDuplicateMatches(candidate, { excludeClientId } = {}) {
    const n = prepareClient({ _id: '__candidate__', ...candidate })._n;

    // Same blocking keys the scan uses, plus the swapped first/last variant.
    // n.* values are normalized to [A-Z0-9 ] so they are safe inside ILIKE patterns.
    const or = [];
    if (n.birthdate && n.last) or.push({ birthdate: { _ilike: `${n.birthdate}%` }, lastName: { _ilike: `${n.last[0]}%` } });
    if (n.phone) or.push({ contactNumber: { _ilike: `%${n.phone}` } });
    if (n.last.length >= 3 && n.first) {
        or.push({ lastName: { _ilike: `${n.last.slice(0, 4)}%` }, firstName: { _ilike: `${n.first.slice(0, 2)}%` } });
    }
    if (n.first.length >= 3 && n.last) {
        or.push({ lastName: { _ilike: `${n.first.slice(0, 4)}%` }, firstName: { _ilike: `${n.last.slice(0, 2)}%` } });
    }
    if (!or.length) return [];

    const where = {
        status: { _nin: ['merged', 'archived'] },
        _or: or,
        ...(excludeClientId ? { _id: { _neq: excludeClientId } } : {}),
    };
    const existing = await graph.query(
        queryQl(CANDIDATE_TYPE, { where, limit: 100 })
    ).then(r => r.data?.clients ?? []);
    if (!existing.length) return [];

    const loans = await graph.query(
        queryQl(LOAN_TYPE, {
            where: { clientId: { _in: existing.map(e => e._id) }, status: { _in: ['active', 'pending'] } },
            limit: 1000,
        })
    ).then(r => r.data?.loans ?? []);
    const loanState = {};
    for (const l of loans) {
        const s = loanState[l.clientId] ?? (loanState[l.clientId] = {});
        if (l.status === 'active') s.active = true;
        if (l.status === 'pending') s.pending = true;
    }

    return evaluateMatches(candidate, existing, loanState);
}

/** Trimmed, PII-light view of a match for API responses to authenticated staff. */
export function toMatchSummary(m) {
    const c = m.client;
    return {
        clientId: c._id,
        name: [c.lastName, c.firstName, c.middleName].filter(Boolean).join(', '),
        birthdate: c.birthdate ?? null,
        branchName: c.branchName ?? null,
        status: c.status,
        confidence: m.confidence,
        reasons: m.reasons,
        hasActiveLoan: m.hasActiveLoan,
        hasPendingLoan: m.hasPendingLoan,
    };
}
