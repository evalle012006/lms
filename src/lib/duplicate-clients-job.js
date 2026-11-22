// src/lib/duplicate-clients-job.js
// Runs the duplicate-client scan and stores the result in duplicate_client_clusters,
// so the admin page can read paginated rows instead of scanning on every page load.
//
// Used by:
//   - pages/api/v2/cronjobs/detect-duplicate-clients.js   (nightly, Hasura cron trigger)
//   - pages/api/v2/clients/duplicates/rescan.js            (admin "Re-scan" button, runs in background)
//
// Requires migration database/postgre-migrations/005_duplicate_clients.sql.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { findFaceMatchesAsync, parseFaceTemplate } from '@/lib/duplicate-faces';
import { heapGuard, heapStats, liveHeapMb } from '@/lib/heap-guard';
import { withRetry, describeError } from '@/lib/retry';
import { beginCronRun, finishCronRun } from '@/lib/cron-guard';
import {
    detectDuplicates, detectMultiActiveLoans, clusterKey, normalizeText, normalizePhone,
} from '@/lib/duplicate-clients';

const rawGraph = new GraphProvider();
// Every DB call in this job retries on transient network errors (e.g. "other side closed" on a stale keep-alive
// connection after a long CPU-bound step). All calls here are idempotent (reads, upserts, status updates); the one
// exception — creating the run row — uses rawGraph.
const graph = {
    query: (...a) => withRetry(() => rawGraph.query(...a)),
    mutation: (...a) => withRetry(() => rawGraph.mutation(...a)),
};

const PAGE_SIZE = 5000;
const ID_CHUNK = 1000;
const UPSERT_CHUNK = 200;
// A run still marked 'running' after this long is assumed dead (crash / restart) and no longer blocks new runs.
const STALE_RUN_MS = 30 * 60 * 1000;

const CONFIDENCE_RANK = { exact: 3, high: 2, possible: 1 };

const CLIENT_TYPE = createGraphType('client', `
  _id firstName middleName lastName birthdate contactNumber
  address addressStreetNo addressBarangayDistrict addressMunicipalityCity addressProvince
  branchId branchName groupId groupName loId oldGroupId oldLoId
  status dateAdded delinquent insertedBy
`)('clients');
const LOAN_TYPE = createGraphType('loans', `
  _id clientId status loanCycle principalLoan loanBalance slotNo dateGranted closedDate groupId
`)('loans');
const FACE_TYPE = createGraphType('client', `_id faceTemplate`)('faceClients');
const BRANCH_TYPE = createGraphType('branches', `_id name`)('branches');
const EXCLUSION_TYPE = createGraphType('duplicate_client_exclusions', `_id`)('duplicate_client_exclusions');
const USER_TYPE = createGraphType('users', `_id firstName lastName`)('users');
const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', `_id status review_status reviewed_member_ids`);
const RUN_TYPE = createGraphType('duplicate_scan_runs', `_id status started_at finished_at stats error trigger`);

const UPSERT_COLUMNS = [
    'view', 'confidence', 'confidence_rank', 'severity', 'scenarios', 'reasons',
    'active_count', 'member_count', 'exact_closed_vs_active',
    'branch_ids', 'lo_ids', 'group_ids', 'search_text', 'members',
    'status', 'last_seen_at', 'resolved_at',
];

async function fetchAll(type, where, onPage) {
    const key = type.alias ?? type.name;
    const out = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const rows = await graph.query(
            queryQl(type, { where, order_by: [{ _id: 'asc' }], limit: PAGE_SIZE, offset })
        ).then(r => {
            // Queries run with errorPolicy 'all': a GraphQL error comes back as r.errors with data null and would
            // otherwise look like an empty table (e.g. exclusions silently not loaded).
            if (r.errors?.length) throw new Error(`GraphQL error reading ${key}: ${r.errors[0].message}`);
            return r.data?.[key] ?? [];
        });
        out.push(...rows);
        if (onPage) await onPage(out.length);
        if (rows.length < PAGE_SIZE) break;
    }
    return out;
}

/** Like fetchAll but hands each page to `onRows` and keeps nothing — for big result sets we only need a slim form of. */
async function fetchEach(type, where, onRows, onPage) {
    const key = type.alias ?? type.name;
    let total = 0;
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const rows = await graph.query(
            queryQl(type, { where, order_by: [{ _id: 'asc' }], limit: PAGE_SIZE, offset })
        ).then(r => r.data?.[key] ?? []);
        onRows(rows);
        total += rows.length;
        if (onPage) await onPage(total);
        if (rows.length < PAGE_SIZE) break;
    }
    return total;
}

/** Latest run row, or null. Used by the list API and the lock check. */
export async function getLatestRun() {
    const [run] = await graph.query(
        queryQl(RUN_TYPE('runs'), { order_by: [{ started_at: 'desc' }], limit: 1 })
    ).then(r => r.data?.runs ?? []);
    return run ?? null;
}

export function isRunActive(run) {
    return !!run && run.status === 'running' && Date.now() - new Date(run.started_at).getTime() < STALE_RUN_MS;
}

/**
 * @returns {Promise<{ started: boolean, runId?: string, reason?: string }>}
 * Starts a scan in the background (does not wait for it). Refuses if one is already running.
 */
export async function startDuplicateScan({ trigger, triggeredBy = null, req = null }) {
    const latest = await getLatestRun();
    if (isRunActive(latest)) return { started: false, reason: 'already_running', runId: latest._id };

    // Atomic lock (cron_runs partial unique index): the check above is only a fast path — two triggers (or
    // app containers) can both pass it. Fails open if cron_runs is missing, like the other cron jobs.
    const lock = await beginCronRun('detect-duplicate-clients', { trigger, staleMinutes: Math.ceil(STALE_RUN_MS / 60000) });
    if (!lock.started) return { started: false, reason: 'already_running' };

    const runId = generateUUID();
    try {
        await rawGraph.mutation(insertQl(RUN_TYPE('runs'), {
            objects: [{ _id: runId, trigger, triggered_by: triggeredBy, status: 'running' }],
        }));
    } catch (err) {
        await finishCronRun(lock.runId, { ok: false, error: describeError(err) });
        throw err;
    }

    // Intentionally not awaited — the caller returns immediately and polls the run row.
    // Which of the app containers is running it (HOSTNAME = the short container id from `docker ps`).
    console.log('[duplicate-scan] started', JSON.stringify({ runId, trigger, host: process.env.HOSTNAME ?? null }));
    runScan(runId, req)
        .catch(err => ({ ok: false, error: describeError(err) || String(err) }))
        .then(res => finishCronRun(lock.runId, {
            ok: !!res?.ok, stats: { scanRunId: runId }, error: res?.ok ? null : (res?.error ?? 'scan failed'),
        }))
        .catch(err => console.error('[duplicate-scan] could not close cron_runs row:', err));
    return { started: true, runId };
}

async function runScan(runId, req) {
    const t0 = Date.now();
    const timings = {};
    const lap = (name, since) => { timings[name] = Date.now() - since; return Date.now(); };

    // Live progress for the page (polls every 5 s) — stored in duplicate_scan_runs.stats.progress.
    let phase = 'starting';
    const guard = heapGuard();
    const report = (p, label, detail = {}) => {
        phase = p;
        guard(p);   // throws (-> failed run) instead of letting the container run out of memory
        return graph.mutation(updateQl(RUN_TYPE('r'), {
            set: { stats: { progress: { phase: p, label, ...detail, heapMb: heapStats().usedMb, at: new Date().toISOString() }, timings: { ...timings } } },
            where: { _id: { _eq: runId } },
        })).catch(() => {});   // progress is best-effort; never fail the scan over it
    };

    let failure = null;
    try {
        const scanStartedAt = new Date().toISOString();

        let t = Date.now();
        // Merged/archived clients are already-resolved duplicates — never re-flag them.
        await report('fetch_clients', 'Loading clients');
        let clients = await fetchAll(CLIENT_TYPE, {
            status: { _nin: ['merged', 'archived'] },
            _or: [{ archived: { _is_null: true } }, { archived: { _eq: false } }],
        }, n => report('fetch_clients', 'Loading clients', { count: n }));
        t = lap('fetchClientsMs', t);

        await report('fetch_loans', 'Loading active loans');
        let activeLoans = await fetchAll(LOAN_TYPE, { status: { _eq: 'active' } });
        t = lap('fetchActiveLoansMs', t);
        timings.liveHeapMb = { afterFetch: liveHeapMb() };   // heap really retained (post-GC), to see which phase holds the memory

        const activeIds = new Set(activeLoans.map(l => l.clientId));
        // Phase 4: face evidence. Fails soft — a face-pass error must not lose the text-based results.
        let facePairs = [];
        await report('faces', 'Comparing faces');
        if (process.env.DUPLICATE_SCAN_FACES === 'off') timings.faceSkipped = true;
        else try {
            // Parse each page into a 512-byte Float32Array right away and drop the ~3 KB template string:
            // ~100k faces as strings + parsed copies was a big part of the heap.
            const faceClients = [];
            await fetchEach(FACE_TYPE, {
                faceTemplate: { _is_null: false },
                status: { _nin: ['merged', 'archived'] },
            }, rows => {
                for (const r of rows) {
                    const v = parseFaceTemplate(r.faceTemplate);
                    if (v) faceClients.push({ _id: r._id, v });
                }
            }, n => report('faces', 'Comparing faces', { count: n }));
            // Cooperative + time-boxed: never freezes the app process, and a runaway pass is abandoned (fail-soft).
            const maxMs = Number(process.env.DUPLICATE_SCAN_FACE_MAX_MS) || 15 * 60 * 1000;
            const faceRes = await findFaceMatchesAsync(faceClients, activeIds, {
                maxMs,
                onProgress: n => report('faces', 'Comparing faces', { compared: n, of: activeIds.size }),
            });
            facePairs = faceRes.pairs;
            timings.faceClients = faceClients.length;
            timings.facePairs = facePairs.length;
            if (faceRes.timedOut) timings.faceTimedOut = true;
            if (faceRes.capped) timings.faceCapped = true;
            timings.faceRawMatches = faceRes.rawMatches;   // matches under the threshold before the caps: how noisy it is
            timings.faceActiveCompared = faceRes.compared;
        } catch (e) {
            console.error('[duplicate-scan] face pass skipped', e);
            timings.faceError = String(e?.message ?? e).slice(0, 200);
        }
        t = lap('faceMs', t);

        await report('detect', 'Finding duplicate groups');
        // Reviewer decisions "these two are different people" — fails soft if migration 012 is not applied yet.
        let exclusions = new Set();
        try { exclusions = new Set((await fetchAll(EXCLUSION_TYPE, {})).map(e => e._id)); }
        catch (e) { console.error('[duplicate-scan] exclusions not loaded', e); timings.exclusionsError = String(e?.message ?? e).slice(0, 120); }
        timings.exclusions = exclusions.size;
        const { clusters: fuzzy, stats } = detectDuplicates(clients, activeIds, facePairs, { onTick: guard, exclusions });
        const sameClient = detectMultiActiveLoans(clients, activeLoans);
        // Not needed any more: only the (much smaller) cluster members stay referenced through enrich + save.
        clients = null;
        activeLoans = null;
        t = lap('detectMs', t);
        timings.liveHeapMb.afterDetect = liveHeapMb();

        const clusters = [...fuzzy, ...sameClient];
        const memberIds = [...new Set(clusters.flatMap(c => c.members.map(m => m._id)))];
        await report('enrich', 'Loading loan details', { total: memberIds.length });
        const loansByClient = await loadLoanSummaries(memberIds, done => report('enrich', 'Loading loan details', { count: done, total: memberIds.length }));
        const loNames = await loadLoNames();
        const branchNames = await loadBranchNames();
        t = lap('enrichMs', t);
        timings.liveHeapMb.afterEnrich = liveHeapMb();

        for (const c of clusters) {
            for (const m of c.members) {
                m.loName = loNames[m.effLoId] ?? null;
                // ~95k clients have branchId but an empty denormalised branchName — resolve it from the branches table.
                if (!m.branchName && m.branchId) m.branchName = branchNames[m.branchId] ?? m.branchName;
                const s = loansByClient[m._id] ?? { loanCount: 0, activeLoan: null, lastClosedDate: null };
                m.loanCount = s.loanCount;
                m.activeLoan = m.activeLoan ?? s.activeLoan;
                m.lastClosedDate = s.lastClosedDate;
            }
        }

        await report('save', 'Saving results', { total: clusters.length });
        const { insertedCount, alertable, reopened, resolved } = await persist(clusters, scanStartedAt, guard);
        lap('persistMs', t);

        // Alert only on NEW groups where more than one loan is active at the same time.
        // A scan that re-groups everything (first run, or after an engine change) can find thousands of "new" groups at
        // once: one summary entry instead of a flood of per-group CRITICAL alerts.
        const ALERT_MAX = Number(process.env.DUPLICATE_ALERT_MAX) || 200;
        if (alertable.length > ALERT_MAX) {
            logAudit(req, {
                action: 'DUPLICATE_CLIENTS_DETECTED', category: 'CLIENT', severity: 'CRITICAL', entityType: 'client',
                entityId: 'duplicate-scan', userName: 'Duplicate scan',
                description: `${alertable.length} new duplicate groups with more than one active loan were found (individual alerts suppressed above ${ALERT_MAX}).`,
                metadata: { newBothActive: alertable.length, suppressed: true },
            });
        }
        for (const c of alertable.length > ALERT_MAX ? [] : alertable) {
            logAudit(req, {
                action: 'DUPLICATE_CLIENTS_DETECTED',
                category: 'CLIENT',
                severity: 'CRITICAL',
                entityType: 'client',
                entityId: c.members[0]._id,
                userName: 'Duplicate scan',
                description: c.view === 'same_client'
                    ? `Client ${c.members[0]._id} has ${c.activeCount} active loans`
                    : `${c.memberCount} possible duplicate records with ${c.activeCount} active loans`,
                metadata: { clusterId: clusterId(c), view: c.view, clientIds: c.members.map(m => m._id) },
            });
        }

        const finalStats = {
            ...stats,
            clusters: clusters.length,
            newClusters: insertedCount,
            reopenedClusters: reopened,
            resolvedClusters: resolved,
            alerts: alertable.length,
            totalMs: Date.now() - t0,
            ...timings,
        };
        console.log('[duplicate-scan] done', JSON.stringify(finalStats));
        await graph.mutation(updateQl(RUN_TYPE('r'), {
            set: { status: 'success', finished_at: new Date().toISOString(), stats: finalStats },
            where: { _id: { _eq: runId } },
        }));
    } catch (err) {
        console.error('[duplicate-scan] failed in phase', phase, err);
        failure = `[${phase}] ${describeError(err) || String(err)}`.slice(0, 1000);
        await graph.mutation(updateQl(RUN_TYPE('r'), {
            set: {
                status: 'failed', finished_at: new Date().toISOString(),
                error: `[${phase}] ${describeError(err) || String(err)}`.slice(0, 1000),
                stats: { failedPhase: phase, timings: { ...timings }, totalMs: Date.now() - t0 },
            },
            where: { _id: { _eq: runId } },
        })).catch(() => {});
        return { ok: false, error: failure };
    }
    return { ok: true };
}

const clusterId = clusterKey;

async function persist(clusters, scanStartedAt, guard = () => {}) {
    const existing = await fetchAll(CLUSTER_TYPE('duplicate_client_clusters'), {});
    console.log('[duplicate-scan] save start', JSON.stringify({ clusters: clusters.length, existing: existing.length, liveHeapMb: liveHeapMb() }));
    const existingById = new Map(existing.map(e => [e._id, e]));

    const nowIso = new Date().toISOString();
    const toRow = (c) => {
        const members = c.members;
        return {
            _id: clusterId(c),
            view: c.view,
            confidence: c.confidence,
            confidence_rank: CONFIDENCE_RANK[c.confidence],
            severity: c.severity,
            scenarios: c.scenarios,
            reasons: c.reasons,
            active_count: c.activeCount,
            member_count: c.memberCount,
            exact_closed_vs_active: c.exactClosedVsActive,
            branch_ids: [...new Set(members.map(m => m.branchId).filter(Boolean))],
            lo_ids: [...new Set(members.map(m => m.effLoId).filter(Boolean))],
            group_ids: [...new Set(members.map(m => m.effGroupId).filter(Boolean))],
            search_text: members.map(m => [
                m._id,
                normalizeText(`${m.firstName ?? ''} ${m.middleName ?? ''} ${m.lastName ?? ''}`),
                normalizePhone(m.contactNumber) ?? '',
            ].join(' ')).join(' '),
            members,
            status: 'open',
            last_seen_at: nowIso,
            resolved_at: null,
        };
    };

    // Streamed: build and write one chunk at a time instead of materialising a second copy of every cluster.
    const alertable = [];          // only NEW both_active groups are alerted on — the only ones we need to keep
    let insertedCount = 0;
    let reopened = 0;
    const seen = new Set();
    const resetIds = [];

    for (let i = 0; i < clusters.length; i += UPSERT_CHUNK) {
        guard('save');
        if ((i / UPSERT_CHUNK) % 50 === 0) console.log('[duplicate-scan] saving', JSON.stringify({ done: i, of: clusters.length, usedMb: heapStats().usedMb }));
        const slice = clusters.slice(i, i + UPSERT_CHUNK);
        const rows = slice.map(toRow);
        rows.forEach((row, k) => {
            seen.add(row._id);
            const e = existingById.get(row._id);
            const prev = e?.status;
            if (prev === undefined || prev === 'resolved') {
                if (prev === 'resolved') reopened += 1;
                insertedCount += 1;
                if (slice[k].severity === 'both_active') alertable.push(slice[k]);
            }
            // A 'not_duplicate' decision only holds for the records that were reviewed. If a NEW record has
            // joined the group since, bring it back for review. ('confirmed' decisions always stay.)
            if (e?.review_status === 'not_duplicate' && Array.isArray(e.reviewed_member_ids)
                && row.members.some(m => !e.reviewed_member_ids.includes(m._id))) resetIds.push(row._id);
        });
        await graph.mutation(insertQl(CLUSTER_TYPE('c'), {
            objects: rows,
            on_conflict: {
                constraint: 'duplicate_client_clusters_pkey',
                // first_detected_at is deliberately NOT updated.
                update_columns: UPSERT_COLUMNS,
            },
        }));
    }

    for (let i = 0; i < resetIds.length; i += ID_CHUNK) {
        await graph.mutation(updateQl(CLUSTER_TYPE('rv'), {
            set: {
                review_status: null, review_note: null, reviewed_by: null,
                reviewed_by_name: null, reviewed_at: null, reviewed_member_ids: null,
            },
            where: { _id: { _in: resetIds.slice(i, i + ID_CHUNK) } },
        }));
    }

    // Anything still open that this scan did not see is resolved (merged, fixed, or no longer matching).
    const staleIds = existing.filter(e => e.status === 'open' && !seen.has(e._id)).map(e => e._id);
    for (let i = 0; i < staleIds.length; i += ID_CHUNK) {
        await graph.mutation(updateQl(CLUSTER_TYPE('s'), {
            set: { status: 'resolved', resolved_at: nowIso },
            where: { _id: { _in: staleIds.slice(i, i + ID_CHUNK) } },
        }));
    }

    return { insertedCount, alertable, reopened, resolved: staleIds.length };
}

async function loadBranchNames() {
    const rows = await graph.query(queryQl(BRANCH_TYPE, {})).then(r => r.data?.branches ?? []);
    return Object.fromEntries(rows.map(b => [b._id, b.name]));
}

async function loadLoNames() {
    const users = await graph.query(
        queryQl(USER_TYPE, { where: { role: { _contains: { rep: 4 } } } })
    ).then(r => r.data?.users ?? []);
    return Object.fromEntries(users.map(u => [u._id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()]));
}

async function loadLoanSummaries(clientIds, onChunk) {
    const out = {};
    for (let i = 0; i < clientIds.length; i += ID_CHUNK) {
        const chunk = clientIds.slice(i, i + ID_CHUNK);
        const loans = await graph.query(
            queryQl(LOAN_TYPE, {
                where: { clientId: { _in: chunk }, status: { _in: ['active', 'completed', 'closed'] } },
                order_by: [{ loanCycle: 'desc' }],
            })
        ).then(r => r.data?.loans ?? []);
        if (onChunk) await onChunk(Math.min(i + ID_CHUNK, clientIds.length));

        for (const l of loans) {
            const s = out[l.clientId] ?? (out[l.clientId] = { loanCount: 0, activeLoan: null, lastClosedDate: null });
            s.loanCount += 1;
            if (l.status === 'active' && !s.activeLoan) {
                s.activeLoan = {
                    loanCycle: l.loanCycle, principalLoan: l.principalLoan,
                    loanBalance: l.loanBalance, slotNo: l.slotNo, dateGranted: l.dateGranted,
                };
            } else if (l.status !== 'active' && l.closedDate && (!s.lastClosedDate || l.closedDate > s.lastClosedDate)) {
                s.lastClosedDate = l.closedDate;
            }
        }
    }
    return out;
}
