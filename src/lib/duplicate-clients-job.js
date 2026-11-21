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
import { findFaceMatches } from '@/lib/duplicate-faces';
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
        ).then(r => r.data?.[key] ?? []);
        out.push(...rows);
        if (onPage) await onPage(out.length);
        if (rows.length < PAGE_SIZE) break;
    }
    return out;
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
    runScan(runId, req)
        .catch(err => console.error('[duplicate-scan] unexpected failure:', err))
        .finally(() => finishCronRun(lock.runId, { ok: true, stats: { scanRunId: runId } }));
    return { started: true, runId };
}

async function runScan(runId, req) {
    const t0 = Date.now();
    const timings = {};
    const lap = (name, since) => { timings[name] = Date.now() - since; return Date.now(); };

    // Live progress for the page (polls every 5 s) — stored in duplicate_scan_runs.stats.progress.
    let phase = 'starting';
    const report = (p, label, detail = {}) => {
        phase = p;
        return graph.mutation(updateQl(RUN_TYPE('r'), {
            set: { stats: { progress: { phase: p, label, ...detail, at: new Date().toISOString() }, timings: { ...timings } } },
            where: { _id: { _eq: runId } },
        })).catch(() => {});   // progress is best-effort; never fail the scan over it
    };

    try {
        const scanStartedAt = new Date().toISOString();

        let t = Date.now();
        // Merged/archived clients are already-resolved duplicates — never re-flag them.
        await report('fetch_clients', 'Loading clients');
        const clients = await fetchAll(CLIENT_TYPE, {
            status: { _nin: ['merged', 'archived'] },
            _or: [{ archived: { _is_null: true } }, { archived: { _eq: false } }],
        }, n => report('fetch_clients', 'Loading clients', { count: n }));
        t = lap('fetchClientsMs', t);

        await report('fetch_loans', 'Loading active loans');
        const activeLoans = await fetchAll(LOAN_TYPE, { status: { _eq: 'active' } });
        t = lap('fetchActiveLoansMs', t);

        const activeIds = new Set(activeLoans.map(l => l.clientId));
        // Phase 4: face evidence. Fails soft — a face-pass error must not lose the text-based results.
        let facePairs = [];
        await report('faces', 'Comparing faces');
        try {
            const faceClients = await fetchAll(FACE_TYPE, {
                faceTemplate: { _is_null: false },
                status: { _nin: ['merged', 'archived'] },
            }, n => report('faces', 'Comparing faces', { count: n }));
            facePairs = findFaceMatches(faceClients, activeIds);
            timings.faceClients = faceClients.length;
            timings.facePairs = facePairs.length;
        } catch (e) {
            console.error('[duplicate-scan] face pass skipped', e);
            timings.faceError = String(e?.message ?? e).slice(0, 200);
        }
        t = lap('faceMs', t);

        await report('detect', 'Finding duplicate groups');
        const { clusters: fuzzy, stats } = detectDuplicates(clients, activeIds, facePairs);
        const sameClient = detectMultiActiveLoans(clients, activeLoans);
        t = lap('detectMs', t);

        const clusters = [...fuzzy, ...sameClient];
        const memberIds = [...new Set(clusters.flatMap(c => c.members.map(m => m._id)))];
        await report('enrich', 'Loading loan details', { total: memberIds.length });
        const loansByClient = await loadLoanSummaries(memberIds, done => report('enrich', 'Loading loan details', { count: done, total: memberIds.length }));
        const loNames = await loadLoNames();
        t = lap('enrichMs', t);

        for (const c of clusters) {
            for (const m of c.members) {
                m.loName = loNames[m.effLoId] ?? null;
                const s = loansByClient[m._id] ?? { loanCount: 0, activeLoan: null, lastClosedDate: null };
                m.loanCount = s.loanCount;
                m.activeLoan = m.activeLoan ?? s.activeLoan;
                m.lastClosedDate = s.lastClosedDate;
            }
        }

        await report('save', 'Saving results', { total: clusters.length });
        const { inserted, reopened, resolved } = await persist(clusters, scanStartedAt);
        lap('persistMs', t);

        // Alert only on NEW groups where more than one loan is active at the same time.
        const alertable = inserted.filter(c => c.severity === 'both_active');
        for (const c of alertable) {
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
            newClusters: inserted.length,
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
        await graph.mutation(updateQl(RUN_TYPE('r'), {
            set: {
                status: 'failed', finished_at: new Date().toISOString(),
                error: `[${phase}] ${describeError(err) || String(err)}`.slice(0, 1000),
                stats: { failedPhase: phase, timings: { ...timings }, totalMs: Date.now() - t0 },
            },
            where: { _id: { _eq: runId } },
        })).catch(() => {});
    }
}

const clusterId = clusterKey;

async function persist(clusters, scanStartedAt) {
    const existing = await fetchAll(CLUSTER_TYPE('duplicate_client_clusters'), {});
    const existingById = new Map(existing.map(e => [e._id, e]));

    const nowIso = new Date().toISOString();
    const rows = clusters.map(c => {
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
    });

    const inserted = [];
    let reopened = 0;
    rows.forEach((row, i) => {
        const prev = existingById.get(row._id)?.status;
        if (prev === undefined) inserted.push(clusters[i]);
        else if (prev === 'resolved') { reopened += 1; inserted.push(clusters[i]); }
    });

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        await graph.mutation(insertQl(CLUSTER_TYPE('c'), {
            objects: rows.slice(i, i + UPSERT_CHUNK),
            on_conflict: {
                constraint: 'duplicate_client_clusters_pkey',
                // first_detected_at is deliberately NOT updated.
                update_columns: UPSERT_COLUMNS,
            },
        }));
    }

    // A 'not_duplicate' decision only holds for the records that were reviewed. If a NEW record has joined
    // the group since, bring it back for review. ('confirmed' decisions always stay.)
    const resetIds = rows.filter(r => {
        const e = existingById.get(r._id);
        return e?.review_status === 'not_duplicate' && Array.isArray(e.reviewed_member_ids)
            && r.members.some(m => !e.reviewed_member_ids.includes(m._id));
    }).map(r => r._id);
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
    const seen = new Set(rows.map(r => r._id));
    const staleIds = existing.filter(e => e.status === 'open' && !seen.has(e._id)).map(e => e._id);
    for (let i = 0; i < staleIds.length; i += ID_CHUNK) {
        await graph.mutation(updateQl(CLUSTER_TYPE('s'), {
            set: { status: 'resolved', resolved_at: nowIso },
            where: { _id: { _in: staleIds.slice(i, i + ID_CHUNK) } },
        }));
    }

    return { inserted, reopened, resolved: staleIds.length };
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
