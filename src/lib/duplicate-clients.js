// src/lib/duplicate-clients.js
// Pure duplicate-client detection engine (no DB / network access) so it can be
// unit-tested and reused by the admin API and any future cron/report.
//
// Pipeline:  normalize -> blocking keys -> candidate pairs -> score/classify
//            -> union-find clusters -> split into "active" / "closed" views.
//
// Blocking keeps this O(n * bucket) instead of O(n^2): only clients sharing a
// cheap key (birthdate+initial, phone, exact name key, name prefix) are ever
// compared with each other.

import moment from 'moment';

// ───────────────────────────── constants ─────────────────────────────

export const CONFIDENCE = { EXACT: 'exact', HIGH: 'high', POSSIBLE: 'possible' };
const CONFIDENCE_RANK = { exact: 3, high: 2, possible: 1 };

export const SCENARIO = {
    CROSS_BRANCH:        'cross_branch',         // different branch
    SAME_BRANCH_DIFF_LO: 'same_branch_diff_lo',  // same branch, different LO
    SAME_LO_DIFF_GROUP:  'same_lo_diff_group',   // same branch + LO, different group
    SAME_GROUP:          'same_group',           // same group (maybe different slot)
};

// Buckets larger than this are too generic to compare (e.g. a placeholder
// birthdate like 01/01/1990) — skipped and reported instead of exploding to O(n^2).
const MAX_BUCKET_SIZE = 150;

const NAME_SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV']);

// ───────────────────────────── normalizers ─────────────────────────────

export function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents (Ñ -> N)
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')                        // punctuation -> space
        .replace(/\s+/g, ' ')
        .trim();
}

function nameTokens(value) {
    return normalizeText(value)
        .split(' ')
        .filter(t => t && !NAME_SUFFIXES.has(t));
}

export function normalizeName(value) {
    return nameTokens(value).join(' ');
}

// Returns 'YYYY-MM-DD' or null. Accepts ISO strings, 'April 06, 1975', 'MM/DD/YYYY', etc.
export function normalizeBirthdate(value) {
    if (!value) return null;
    const m = moment(
        String(value).trim(),
        [moment.ISO_8601, 'YYYY-MM-DD', 'MM/DD/YYYY', 'M/D/YYYY', 'MMMM DD, YYYY', 'MMM DD, YYYY', 'DD-MM-YYYY'],
        true
    );
    if (!m.isValid()) return null;
    const year = m.year();
    if (year < 1900 || year > moment().year() - 15) return null;   // junk / default dates
    return m.format('YYYY-MM-DD');
}

// Last 10 digits of a PH mobile number (09953661887 / +639953661887 / 9953661887).
export function normalizePhone(value) {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 10) return null;
    const last10 = digits.slice(-10);
    if (/^(\d)\1+$/.test(last10)) return null;            // 0000000000 / 9999999999
    return last10;
}

function normalizeAddress(c) {
    const parts = [c.addressStreetNo, c.addressBarangayDistrict, c.addressMunicipalityCity]
        .map(normalizeText).filter(Boolean);
    if (parts.length >= 2) return parts.join('|');
    return normalizeText(c.address) || null;
}

// ───────────────────────────── string similarity ─────────────────────────────

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        prev = cur;
    }
    return prev[b.length];
}

export function ratio(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const max = Math.max(a.length, b.length);
    return 1 - levenshtein(a, b) / max;
}

// Birthdates that differ by a single-digit typo or a day/month swap.
function birthdateNear(a, b) {
    if (!a || !b || a === b) return false;
    const da = a.replace(/-/g, ''), db = b.replace(/-/g, '');
    if (levenshtein(da, db) <= 1) return true;
    const [ya, ma, dda] = a.split('-');
    const [yb, mb, ddb] = b.split('-');
    return ya === yb && ma === ddb && dda === mb;          // 04-06 vs 06-04
}

// ───────────────────────────── prepare ─────────────────────────────

export function prepareClient(c) {
    const firstTokens = nameTokens(c.firstName);
    const lastTokens = nameTokens(c.lastName);
    const middle = normalizeName(c.middleName);
    const first = firstTokens.join(' ');
    const last = lastTokens.join(' ');
    return {
        ...c,
        // For offset clients the live LO/group are cleared and old* hold the last known values.
        effLoId: c.loId && c.loId.trim() ? c.loId : (c.oldLoId || null),
        effGroupId: c.groupId && c.groupId.trim() ? c.groupId : (c.oldGroupId || null),
        _n: {
            first, last, middle,
            // Order-insensitive key — catches first/last name swapped by the encoder.
            nameKey: [first, last].filter(Boolean).sort().join('|'),
            birthdate: normalizeBirthdate(c.birthdate),
            phone: normalizePhone(c.contactNumber),
            address: normalizeAddress(c),
        },
    };
}

// ───────────────────────────── pair scoring ─────────────────────────────

function nameScore(a, b) {
    const direct = (ratio(a.first, b.first) + ratio(a.last, b.last)) / 2;
    const swapped = (ratio(a.first, b.last) + ratio(a.last, b.first)) / 2;
    const swappedWins = swapped > direct;
    return { score: Math.max(direct, swapped), swapped: swappedWins };
}

// Middle names: missing on one side is neutral; both present and initials differ = conflict.
function middleCompat(a, b) {
    if (!a || !b) return { conflict: false, missing: true };
    if (a === b) return { conflict: false, missing: false };
    return { conflict: a[0] !== b[0], missing: false };
}

export function scorePair(a, b) {
    const A = a._n, B = b._n;
    const reasons = [];

    const { score: ns, swapped } = nameScore(A, B);
    if (ns < 0.8) return null;

    const sameBirthdate = !!A.birthdate && A.birthdate === B.birthdate;
    const nearBirthdate = birthdateNear(A.birthdate, B.birthdate);
    const bothHaveBirthdate = !!A.birthdate && !!B.birthdate;
    const birthdateConflict = bothHaveBirthdate && !sameBirthdate && !nearBirthdate;
    const samePhone = !!A.phone && A.phone === B.phone;
    const sameAddress = !!A.address && A.address === B.address;
    const mid = middleCompat(A.middle, B.middle);

    // A different person who happens to share a name: birthdate clearly differs and nothing else ties them.
    if (birthdateConflict && !samePhone) return null;
    if (mid.conflict && !sameBirthdate && !samePhone) return null;

    const exactName = ns === 1;
    if (exactName) reasons.push(swapped ? 'Name (first/last swapped)' : 'Same name');
    else reasons.push(`Similar name (${Math.round(ns * 100)}%)`);
    if (mid.missing && (A.middle || B.middle)) reasons.push('Middle name missing on one record');
    if (sameBirthdate) reasons.push('Same birthdate');
    else if (nearBirthdate) reasons.push('Birthdate differs by a typo / day-month swap');
    else if (!bothHaveBirthdate) reasons.push('Birthdate missing on one record');
    if (samePhone) reasons.push('Same contact number');
    if (sameAddress) reasons.push('Same address');

    let confidence = null;
    if (exactName && !mid.conflict && sameBirthdate) {
        confidence = CONFIDENCE.EXACT;
    } else if (ns >= 0.9 && (sameBirthdate || (samePhone && (sameAddress || nearBirthdate || exactName)))) {
        confidence = CONFIDENCE.HIGH;
    } else if (exactName && (nearBirthdate || sameAddress || samePhone)) {
        confidence = CONFIDENCE.HIGH;
    } else if (ns >= 0.8 && (sameBirthdate || nearBirthdate || samePhone || sameAddress)) {
        confidence = CONFIDENCE.POSSIBLE;
    } else if (exactName && !bothHaveBirthdate) {
        confidence = CONFIDENCE.POSSIBLE;                    // name-only match, nothing to contradict it
    }
    if (!confidence) return null;

    return { confidence, nameScore: ns, reasons, scenario: scenarioOf(a, b) };
}

export function scenarioOf(a, b) {
    if (a.branchId !== b.branchId) return SCENARIO.CROSS_BRANCH;
    if (a.effLoId !== b.effLoId) return SCENARIO.SAME_BRANCH_DIFF_LO;
    if (a.effGroupId !== b.effGroupId) return SCENARIO.SAME_LO_DIFF_GROUP;
    return SCENARIO.SAME_GROUP;
}

// ───────────────────────────── blocking + clustering ─────────────────────────────

function blockingKeys(c) {
    const { first, last, nameKey, birthdate, phone } = c._n;
    const keys = [];
    if (birthdate && last) keys.push(`bd:${birthdate}:${last[0]}`);
    if (phone) keys.push(`ph:${phone}`);
    if (nameKey && first && last) keys.push(`nm:${nameKey}`);
    if (last.length >= 3 && first) keys.push(`pf:${last.slice(0, 4)}|${first.slice(0, 2)}`);
    return keys;
}

// A group is never allowed to grow past this: a bigger "group" is a name-collision pile, not one person.
const MAX_CLUSTER_SIZE = 60;

// Hard evidence that two records are NOT the same person. Used as a cannot-link constraint when joining
// groups, so a record with little data (no middle name, no birthdate) cannot bridge two different people.
// `skipName`: a face match is evidence that does not depend on the name, so differently-named records may join.
function hardConflict(a, b, skipName = false, excluded = null) {
    if (excluded && excluded.has(a._id < b._id ? `${a._id}|${b._id}` : `${b._id}|${a._id}`)) return true;   // reviewer: different people
    const A = a._n, B = b._n;
    const sameBirthdate = !!A.birthdate && A.birthdate === B.birthdate;
    const samePhone = !!A.phone && A.phone === B.phone;
    if (A.birthdate && B.birthdate && !sameBirthdate && !birthdateNear(A.birthdate, B.birthdate) && !samePhone) return true;
    if (middleCompat(A.middle, B.middle).conflict && !sameBirthdate && !samePhone) return true;
    return !skipName && nameScore(A, B).score < 0.8;   // stops slow name drift: A~B, B~C but A is not C
}

/**
 * Agglomerative clustering with cannot-link constraints (replaces plain union-find, which chained
 * different people through any record with sparse data). Strongest links first; a link that would put two
 * conflicting records in one group is rejected.
 */
function clusterLinks(links, byId, excluded = null) {
    links.sort((x, y) => CONFIDENCE_RANK[y.confidence] - CONFIDENCE_RANK[x.confidence] || (y.nameScore ?? 0) - (x.nameScore ?? 0));
    const compOf = new Map();
    const comps = [];
    let rejectedLinks = 0, oversizedLinks = 0;
    const comp = (id) => {
        let c = compOf.get(id);
        if (!c) { c = { ids: [id], tree: [], other: [], dead: false, face: false }; compOf.set(id, c); comps.push(c); }
        return c;
    };
    for (const e of links) {
        const ca = comp(e.idA), cb = comp(e.idB);
        if (ca === cb) { ca.other.push(e); continue; }
        if (ca.ids.length + cb.ids.length > MAX_CLUSTER_SIZE) { oversizedLinks++; continue; }
        const isFace = e.reasons?.some(r => /face/i.test(r));
        const skipName = isFace || ca.face || cb.face;
        const conflict = ca.ids.some(x => cb.ids.some(y => hardConflict(byId.get(x), byId.get(y), skipName, excluded)));
        if (conflict) { rejectedLinks++; continue; }
        ca.ids.push(...cb.ids);
        for (const id of cb.ids) compOf.set(id, ca);
        ca.face = ca.face || cb.face || !!isFace;
        ca.tree.push(e, ...cb.tree);
        ca.other.push(...cb.other);
        cb.dead = true;
    }
    return { comps: comps.filter(c => !c.dead && c.ids.length >= 2), rejectedLinks, oversizedLinks };
}

// What differs between a record and the group's reference record (only fields where BOTH have a value).
function differsFrom(a, b) {
    const A = a._n, B = b._n, out = [];
    if (A.birthdate && B.birthdate && A.birthdate !== B.birthdate) out.push('Birthdate');
    if (A.phone && B.phone && A.phone !== B.phone) out.push('Contact number');
    if (A.middle && B.middle && A.middle !== B.middle) out.push('Middle name');
    return out;
}

// Per-record remark: how this record relates to the group's reference record (the best-connected one).
function buildMatches(g, byId, activeLoanClientIds) {
    const degree = new Map();
    for (const e of g.tree) for (const id of [e.idA, e.idB]) degree.set(id, (degree.get(id) ?? 0) + 1);
    const anchorId = [...g.ids].sort((x, y) =>
        (degree.get(y) ?? 0) - (degree.get(x) ?? 0) ||
        Number(activeLoanClientIds.has(y)) - Number(activeLoanClientIds.has(x)) ||
        (x < y ? -1 : 1))[0];
    const anchor = byId.get(anchorId);
    const all = [...g.tree, ...g.other];
    const matches = new Map([[anchorId, { anchor: true }]]);
    for (const id of g.ids) {
        if (id === anchorId) continue;
        const c = byId.get(id);
        const direct = scorePair(c, anchor);
        if (direct) {
            matches.set(id, { ref: anchorId, confidence: direct.confidence, reasons: direct.reasons, differs: differsFrom(c, anchor) });
            continue;
        }
        let best = null;
        for (const e of all) {
            if (e.idA !== id && e.idB !== id) continue;
            if (!best || CONFIDENCE_RANK[e.confidence] > CONFIDENCE_RANK[best.confidence]) best = e;
        }
        matches.set(id, {
            via: best ? (best.idA === id ? best.idB : best.idA) : null,
            confidence: best?.confidence ?? CONFIDENCE.POSSIBLE,
            reasons: best?.reasons ?? [],
            differs: differsFrom(c, anchor),
        });
    }
    return matches;
}

const isClosedStatus = (s) => ['offset', 'completed', 'closed'].includes(s);

/**
 * @param {Array} clients       raw client rows
 * @param {Set<string>} activeLoanClientIds  clientIds that currently own a loan with status 'active'
 * @returns {{ clusters: Array, stats: object }}
 */
export function detectDuplicates(clients, activeLoanClientIds = new Set(), extraPairs = [], { onTick = null, exclusions = null } = {}) {
    const prepared = clients.map(prepareClient);
    for (const c of prepared) c._keys = blockingKeys(c);
    const byId = new Map(prepared.map(c => [c._id, c]));

    const buckets = new Map();
    for (const c of prepared) {
        for (const k of c._keys) {
            if (!buckets.has(k)) buckets.set(k, []);
            buckets.get(k).push(c);
        }
    }

    // Only MATCHED pairs are stored. (Caching the null results of every candidate pair cost ~400 bytes each and
    // ran the scan out of memory at ~700k clients.) A pair that shares several blocking keys is still scored once:
    // only in the first shared key whose bucket is actually processed.
    const pairs = new Map();             // "idA|idB" -> pair result (matches only)
    let candidatePairs = 0;
    let skippedBuckets = 0;
    const usable = (k) => { const n = buckets.get(k)?.length ?? 0; return n >= 2 && n <= MAX_BUCKET_SIZE; };
    let tick = 0;
    for (const [bucketKey, members] of buckets) {
        if (onTick && (++tick % 200 === 0)) onTick('detect');
        if (members.length < 2) continue;
        if (members.length > MAX_BUCKET_SIZE) { skippedBuckets++; continue; }
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const a = members[i], b = members[j];
                let first = null;
                for (const k of a._keys) { if (usable(k) && b._keys.includes(k)) { first = k; break; } }
                if (first !== bucketKey) continue;           // scored in an earlier shared bucket
                candidatePairs++;
                const res = scorePair(a, b);
                if (!res) continue;
                pairs.set(a._id < b._id ? `${a._id}|${b._id}` : `${b._id}|${a._id}`, res);
            }
        }
    }

    // Extra evidence from outside the text engine (e.g. face matches): {idA, idB, confidence, reasons}.
    for (const e of extraPairs) {
        const a = byId.get(e.idA), b = byId.get(e.idB);
        if (!a || !b) continue;
        const key = a._id < b._id ? `${a._id}|${b._id}` : `${b._id}|${a._id}`;
        const prev = pairs.get(key);
        if (prev) {
            prev.reasons = [...new Set([...prev.reasons, ...e.reasons])];
            if (CONFIDENCE_RANK[e.confidence] > CONFIDENCE_RANK[prev.confidence]) prev.confidence = e.confidence;
        } else {
            pairs.set(key, { confidence: e.confidence, scenario: scenarioOf(a, b), reasons: e.reasons });
        }
    }

    const links = [];
    for (const [key, res] of pairs) {
        if (!res) continue;
        const [idA, idB] = key.split('|');
        links.push({ idA, idB, ...res });
    }
    const goodPairs = links;
    const { comps, rejectedLinks, oversizedLinks } = clusterLinks(links, byId, exclusions);

    const clusters = [];
    for (const g of comps) {
        const matches = buildMatches(g, byId, activeLoanClientIds);
        const members = g.ids.map(id => {
            const c = byId.get(id);
            return {
                ...stripPrepared(c),
                hasActiveLoan: activeLoanClientIds.has(id),
                isClosed: isClosedStatus(c.status),
                match: matches.get(id),
            };
        });

        g.pairs = [...g.tree, ...g.other];
        // The group is only as strong as its WEAKEST joining link (not its best pair).
        const best = g.tree.reduce((m, p) =>
            CONFIDENCE_RANK[p.confidence] < CONFIDENCE_RANK[m] ? p.confidence : m, CONFIDENCE.EXACT);
        const scenarios = [...new Set(g.pairs.map(p => p.scenario))];
        const reasons = [...new Set(g.tree.flatMap(p => p.reasons))];

        const activeMembers = members.filter(m => m.hasActiveLoan);
        const liveMembers = members.filter(m => !m.isClosed);
        const closedMembers = members.filter(m => m.isClosed);

        // View assignment (partition — a cluster appears in exactly one tab):
        //   active : >=1 active-loan member and >=2 live (non-offset) records
        //   closed : has closed/offset record(s) that match an active client or each other
        let view = null;
        if (activeMembers.length >= 1 && liveMembers.length >= 2) view = 'active';
        else if (closedMembers.length >= 1 && (activeMembers.length >= 1 || closedMembers.length >= 2)) view = 'closed';
        if (!view) continue;

        const exactClosedVsActive = view === 'closed' && activeMembers.length >= 1 &&
            g.pairs.some(p => p.confidence === CONFIDENCE.EXACT &&
                [p.idA, p.idB].some(id => activeLoanClientIds.has(id)) &&
                [p.idA, p.idB].some(id => isClosedStatus(byId.get(id).status)));

        clusters.push({
            clusterId: g.ids[0],
            view,
            confidence: best,
            severity: activeMembers.length >= 2 ? 'both_active' : activeMembers.length === 1 ? 'one_active' : 'no_active',
            scenarios,
            reasons,
            activeCount: activeMembers.length,
            memberCount: members.length,
            exactClosedVsActive,
            members: members.sort((a, b) =>
                Number(b.hasActiveLoan) - Number(a.hasActiveLoan) ||
                String(a.dateAdded || '').localeCompare(String(b.dateAdded || ''))),
        });
    }

    clusters.sort((a, b) =>
        (b.activeCount - a.activeCount) ||
        (CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]) ||
        (b.memberCount - a.memberCount));

    return {
        clusters,
        stats: {
            clientsScanned: clients.length,
            candidatePairs,
            matchedPairs: goodPairs.length,
            rejectedLinks,
            oversizedLinks,
            skippedBuckets,
        },
    };
}

// A cluster key that stays stable across runs: 'dc_' + the oldest member id.
// (_ids are time-ordered, so the oldest record is the one that never leaves the group.)
export function clusterKey(cluster) {
    const ids = cluster.members.map(m => m._id).sort();
    return `dc_${ids[0]}`;
}

/**
 * Same client _id owning more than one ACTIVE loan. This is not fuzzy matching —
 * it is a loan-creation integrity problem (double submit, reloan that did not close the previous loan).
 * @param {Array} clients       raw client rows
 * @param {Array} activeLoans   loans with status 'active' ({ _id, clientId, loanCycle, principalLoan, loanBalance, slotNo, dateGranted, groupId })
 */
export function detectMultiActiveLoans(clients, activeLoans) {
    const byClient = new Map();
    for (const l of activeLoans) {
        if (!l.clientId) continue;
        if (!byClient.has(l.clientId)) byClient.set(l.clientId, []);
        byClient.get(l.clientId).push(l);
    }
    const clientById = new Map(clients.map(c => [c._id, c]));
    const out = [];
    for (const [clientId, loans] of byClient) {
        if (loans.length < 2) continue;
        const c = clientById.get(clientId);
        if (!c) continue;
        const p = prepareClient(c);
        out.push({
            clusterId: clientId,
            view: 'same_client',
            confidence: CONFIDENCE.EXACT,
            severity: 'both_active',
            scenarios: [],
            reasons: [`Same client ID has ${loans.length} active loans`],
            activeCount: loans.length,
            memberCount: 1,
            exactClosedVsActive: false,
            members: [{
                ...stripPrepared(p),
                hasActiveLoan: true,
                isClosed: false,
                activeLoans: loans
                    .slice()
                    .sort((a, b) => Number(b.loanCycle) - Number(a.loanCycle))
                    .map(l => ({
                        _id: l._id, loanCycle: l.loanCycle, principalLoan: l.principalLoan,
                        loanBalance: l.loanBalance, slotNo: l.slotNo, dateGranted: l.dateGranted,
                    })),
            }],
        });
    }
    return out.sort((a, b) => b.activeCount - a.activeCount);
}

function stripPrepared(c) {
    const { _n, _keys, ...rest } = c;
    return rest;
}
