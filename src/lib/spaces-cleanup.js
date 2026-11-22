// src/lib/spaces-cleanup.js  (server only)
// Manual orphan cleanup for DigitalOcean Spaces.
//   scan       -> builds the set of every key the DB references, lists the bucket, stores unreferenced objects
//                 in spaces_cleanup_candidates (nothing is moved or deleted).
//   quarantine -> re-checks references, then moves objects to to-delete/<key>   (reversible)
//   restore    -> moves them back
//   purge      -> hard-deletes quarantined objects older than the retention window
// Requires migration database/postgre-migrations/013_spaces_cleanup.sql (+ track both tables in Hasura).

import {
    S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl, insertQl, updateQl, deleteQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { findUserById } from '@/lib/graph.functions';
import { heapGuard } from '@/lib/heap-guard';
import { withRetry, describeError } from '@/lib/retry';
import { beginCronRun, finishCronRun } from '@/lib/cron-guard';
import {
    REFERENCE_SOURCES, PURGE_RETENTION_DAYS, MIN_AGE_HOURS, scanPrefixes, protectedPrefixes,
    isCleanable, minAgeMs, prefixLabel, quarantineKeyOf, referenceVariants, lookupVariants,
} from '@/lib/spaces-cleanup-core';

const BUCKET = () => process.env.SPACES_BUCKET;
const JOB = 'spaces-cleanup-scan';
const STALE_MINUTES = 90;            // a 'running' scan older than this is treated as crashed
const REF_PAGE = 5000;
const LIST_PAGE = 1000;
const FLUSH_AT = 500;
export const ACTION_BATCH = 200;     // objects moved per request; the page loops until none remain
const CONCURRENCY = 8;

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: { accessKeyId: process.env.SPACES_ACCESS_KEY, secretAccessKey: process.env.SPACES_SECRET_KEY },
    forcePathStyle: false,
});

const rawGraph = new GraphProvider();
const graph = {
    query: (...a) => withRetry(() => rawGraph.query(...a)),
    mutation: (...a) => withRetry(() => rawGraph.mutation(...a)),
};

const CAND_FIELDS = '_id run_id object_key prefix size_bytes last_modified status quarantine_key note acted_by acted_at';
const CAND_TYPE = createGraphType('spaces_cleanup_candidates', CAND_FIELDS);
const RUN_TYPE = createGraphType('spaces_cleanup_runs', '_id status trigger triggered_by started_at finished_at stats error');

/** Root only. 200 + success:false, never 403 (403 triggers client-side logout). */
export async function requireRoot(req, res) {
    const user = await findUserById(req.auth?.sub);
    if (!user?.root) {
        res.status(200).json({ success: false, message: 'Insufficient permissions.' });
        return null;
    }
    return user;
}

// Per-segment encoding, same as api/upload.js (CopySource must be URL-encoded, but not the slashes).
const copySource = (key) => `${BUCKET()}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function mapPool(items, fn, size = CONCURRENCY) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
        while (i < items.length) { const n = i++; out[n] = await fn(items[n], n); }
    }));
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN
// ─────────────────────────────────────────────────────────────────────────────

export async function startSpacesScan({ triggeredBy }) {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    const running = await graph.query(queryQl(RUN_TYPE('runs'), {
        where: { status: { _eq: 'running' }, started_at: { _gt: cutoff } }, limit: 1,
    })).then(r => r.data?.runs ?? []);
    if (running.length) return { started: false, reason: 'already_running' };

    // Atomic lock across app containers (cron_runs partial unique index).
    const lock = await beginCronRun(JOB, { trigger: 'manual', staleMinutes: STALE_MINUTES });
    if (!lock.started) return { started: false, reason: 'already_running' };

    const runId = generateUUID();
    try {
        await rawGraph.mutation(insertQl(RUN_TYPE('run'), {
            objects: [{ _id: runId, status: 'running', trigger: 'manual', triggered_by: triggeredBy, stats: { progress: { phase: 'starting' } } }],
        }));
    } catch (err) {
        await finishCronRun(lock.runId, { ok: false, error: describeError(err) });
        throw err;
    }

    // Fire and forget: the HTTP request returns now, the page polls overview.js for progress.
    runScan(runId)
        .then(res => finishCronRun(lock.runId, { ok: res.ok, stats: { scanRunId: runId }, error: res.error ?? null }))
        .catch(err => console.error('[spaces-cleanup] could not close cron_runs row:', err));

    return { started: true, runId };
}

async function collectSource({ table, columns }, refs, guard, bucket) {
    const type = createGraphType(table, `_id ${columns.join(' ')}`)('rows');
    const notNull = { _or: columns.map(c => ({ [c]: { _is_null: false } })) };
    let last = null;
    let rows = 0;
    // Keyset pagination on _id (OFFSET degrades badly on the big tables). graph.query THROWS on any GraphQL error,
    // so a failed/misnamed table aborts the whole scan instead of silently under-counting references.
    for (;;) {
        const where = last === null ? notNull : { _and: [{ _id: { _gt: last } }, notNull] };
        const batch = await graph.query(queryQl(type, { where, order_by: [{ _id: 'asc' }], limit: REF_PAGE }))
            .then(r => r.data?.rows ?? []);
        if (!batch.length) break;
        for (const row of batch) {
            for (const col of columns) for (const v of referenceVariants(row[col], bucket)) refs.add(v);
        }
        rows += batch.length;
        last = batch[batch.length - 1]._id;
        guard(`references:${table}`);
        if (batch.length < REF_PAGE) break;
    }
    return rows;
}

async function clearOrphans() {
    const idType = createGraphType('spaces_cleanup_candidates', '_id');
    for (;;) {
        const ids = await graph.query(queryQl(idType('rows'), { where: { status: { _eq: 'orphan' } }, limit: 2000 }))
            .then(r => (r.data?.rows ?? []).map(x => x._id));
        if (!ids.length) return;
        await graph.mutation(deleteQl(idType('del'), { _id: { _in: ids } }));
    }
}

async function runScan(runId) {
    const t0 = Date.now();
    const guard = heapGuard();
    const bucket = BUCKET();
    const setProgress = (phase, detail = {}) => graph.mutation(updateQl(RUN_TYPE('r'), {
        set: { stats: { progress: { phase, ...detail, at: new Date().toISOString() } } },
        where: { _id: { _eq: runId } },
    })).catch(() => {});   // progress is best-effort; never fail the scan over it

    try {
        // 1. Every key the DB references
        const refs = new Set();
        const perSource = {};
        for (const src of REFERENCE_SOURCES) {
            await setProgress('references', { label: `Reading ${src.table}`, sources: { ...perSource } });
            perSource[src.table] = await collectSource(src, refs, guard, bucket);
        }
        if (refs.size === 0) throw new Error('No file references found in the database — refusing to scan (would flag everything).');

        // 2. List the bucket and keep unreferenced objects. Previous un-reviewed orphans are replaced.
        await clearOrphans();
        const stats = {
            referencedKeys: refs.size, rowsRead: perSource,
            listed: 0, matched: 0, protectedSkipped: 0, tooNew: 0, orphans: 0, orphanBytes: 0, byPrefix: {},
            minAgeHours: MIN_AGE_HOURS, prefixes: scanPrefixes(),
        };
        let buffer = [];
        const flush = async () => {
            if (!buffer.length) return;
            const objects = buffer; buffer = [];
            await graph.mutation(insertQl(CAND_TYPE('ins'), {
                objects,
                // Keys already quarantined / excluded / restored keep their status.
                on_conflict: { constraint: 'spaces_cleanup_candidates_object_key_key', update_columns: [] },
            }));
        };

        const now = Date.now();
        let pages = 0;
        for (const prefix of scanPrefixes()) {
            let token;
            do {
                const res = await withRetry(() => s3.send(new ListObjectsV2Command({
                    Bucket: bucket, Prefix: prefix, MaxKeys: LIST_PAGE, ContinuationToken: token,
                })));
                for (const o of res.Contents || []) {
                    if (o.Key.endsWith('/')) continue;                    // folder placeholder
                    stats.listed++;
                    if (!isCleanable(o.Key)) { stats.protectedSkipped++; continue; }
                    if (refs.has(o.Key)) { stats.matched++; continue; }
                    if (now - new Date(o.LastModified).getTime() < minAgeMs(o.Key)) { stats.tooNew++; continue; }
                    const label = prefixLabel(o.Key);
                    buffer.push({
                        _id: generateUUID(), run_id: runId, object_key: o.Key, prefix: label,
                        size_bytes: o.Size ?? 0, last_modified: new Date(o.LastModified).toISOString(), status: 'orphan',
                    });
                    stats.orphans++; stats.orphanBytes += o.Size ?? 0;
                    const p = (stats.byPrefix[label] ||= { count: 0, bytes: 0 });
                    p.count++; p.bytes += o.Size ?? 0;
                }
                if (buffer.length >= FLUSH_AT) await flush();
                token = res.IsTruncated ? res.NextContinuationToken : undefined;
                pages++;
                guard('listing');
                if (pages % 10 === 0) {
                    await setProgress('listing', { label: `Listing ${prefix}`, listed: stats.listed, orphans: stats.orphans, matched: stats.matched });
                }
            } while (token);
        }
        await flush();

        // 3. Sanity checks — a key-format mismatch would make EVERYTHING look orphaned.
        if (stats.listed > 1000 && stats.matched === 0) {
            await clearOrphans();
            throw new Error(`None of ${stats.listed} listed objects matched any DB reference — key format mismatch. Candidates discarded.`);
        }
        const eligible = stats.listed - stats.protectedSkipped;
        if (eligible > 0 && stats.orphans / eligible > 0.5) {
            stats.warning = `${Math.round((stats.orphans / eligible) * 100)}% of scanned objects are unreferenced. That is unusually high — spot-check previews before quarantining.`;
        }
        stats.totalMs = Date.now() - t0;

        await graph.mutation(updateQl(RUN_TYPE('r'), {
            set: { status: 'success', finished_at: new Date().toISOString(), stats },
            where: { _id: { _eq: runId } },
        }));
        return { ok: true };
    } catch (err) {
        console.error('[spaces-cleanup] scan failed:', err);
        const message = describeError(err);
        await graph.mutation(updateQl(RUN_TYPE('r'), {
            set: { status: 'failed', finished_at: new Date().toISOString(), error: message, stats: { totalMs: Date.now() - t0 } },
            where: { _id: { _eq: runId } },
        })).catch(() => {});
        return { ok: false, error: message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ (overview / list)
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = ['orphan', 'quarantined', 'excluded', 'restored', 'purged'];
const AGG = 'aggregate { count sum { size_bytes } }';
const purgeCutoff = () => new Date(Date.now() - PURGE_RETENTION_DAYS * 86400 * 1000).toISOString();

export async function getOverview() {
    const [lastRun] = await graph.query(queryQl(RUN_TYPE('runs'), { order_by: [{ started_at: 'desc' }], limit: 1 }))
        .then(r => r.data?.runs ?? []);

    const data = await graph.query(
        ...STATUSES.map(s => aggregateQl(CAND_TYPE(`agg_${s}`), AGG, { status: { _eq: s } })),
        aggregateQl(CAND_TYPE('agg_purgeable'), AGG, { status: { _eq: 'quarantined' }, acted_at: { _lt: purgeCutoff() } }),
    ).then(r => r.data);
    const pick = (k) => ({ count: data[k]?.aggregate?.count ?? 0, bytes: data[k]?.aggregate?.sum?.size_bytes ?? 0 });
    const counts = Object.fromEntries(STATUSES.map(s => [s, pick(`agg_${s}`)]));

    const prefixes = {};
    for (const status of ['orphan', 'quarantined']) {
        const names = await graph.query(queryQl(CAND_TYPE('p'), {
            where: { status: { _eq: status } }, distinct_on: ['prefix'], order_by: [{ prefix: 'asc' }], limit: 100,
        })).then(r => (r.data?.p ?? []).map(x => x.prefix));
        if (!names.length) { prefixes[status] = []; continue; }
        const agg = await graph.query(...names.map((p, i) =>
            aggregateQl(CAND_TYPE(`pa${i}`), AGG, { status: { _eq: status }, prefix: { _eq: p } }))).then(r => r.data);
        prefixes[status] = names.map((p, i) => ({
            prefix: p, count: agg[`pa${i}`]?.aggregate?.count ?? 0, bytes: agg[`pa${i}`]?.aggregate?.sum?.size_bytes ?? 0,
        }));
    }

    return {
        lastRun: lastRun ?? null, counts, prefixes, purgeable: pick('agg_purgeable'),
        config: { minAgeHours: MIN_AGE_HOURS, retentionDays: PURGE_RETENTION_DAYS, prefixes: scanPrefixes(), protectedPrefixes: protectedPrefixes() },
    };
}

export async function listCandidates({ status, prefix, page = 1, limit = 25 }) {
    const where = { status: { _eq: status }, ...(prefix ? { prefix: { _eq: prefix } } : {}) };
    const { rows, agg } = await graph.query(
        queryQl(CAND_TYPE('rows'), { where, order_by: [{ size_bytes: 'desc' }, { _id: 'asc' }], limit, offset: (page - 1) * limit }),
        aggregateQl(CAND_TYPE('agg'), AGG, where),
    ).then(r => r.data);
    // Previews are signed locally (no network call). Quarantined objects live under their quarantine key.
    const withUrls = await Promise.all((rows ?? []).map(async (r) => {
        const key = r.status === 'quarantined' ? r.quarantine_key : r.object_key;
        let previewUrl = null;
        if (key && r.status !== 'purged') {
            previewUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET(), Key: key }), { expiresIn: 900 }).catch(() => null);
        }
        return { ...r, previewUrl };
    }));
    return { rows: withUrls, total: agg?.aggregate?.count ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function pickBatch({ ids, prefix, status, extraWhere = {} }) {
    const where = { status: { _eq: status }, ...extraWhere };
    if (Array.isArray(ids) && ids.length) where._id = { _in: ids.slice(0, ACTION_BATCH) };
    else if (prefix) where.prefix = { _eq: prefix };
    return graph.query(queryQl(CAND_TYPE('rows'), { where, order_by: [{ _id: 'asc' }], limit: ACTION_BATCH }))
        .then(r => r.data?.rows ?? []);
}

async function remaining({ ids, prefix, status, extraWhere = {} }) {
    const where = { status: { _eq: status }, ...extraWhere };
    if (Array.isArray(ids) && ids.length) where._id = { _in: ids };
    else if (prefix) where.prefix = { _eq: prefix };
    return graph.query(aggregateQl(CAND_TYPE('a'), 'aggregate { count }', where)).then(r => r.data?.a?.aggregate?.count ?? 0);
}

const setRow = (id, set) => graph.mutation(updateQl(CAND_TYPE('u'), { set, where: { _id: { _eq: id } } }));

/** Which of `keys` are referenced by any table right now. Fail-closed: a query error throws and nothing moves. */
async function findReferencedKeys(keys) {
    const bucket = BUCKET();
    const wanted = new Set(keys);
    const variants = [...new Set(keys.flatMap(k => lookupVariants(k, bucket)))];
    const found = new Set();
    for (const { table, columns } of REFERENCE_SOURCES) {
        const type = createGraphType(table, `_id ${columns.join(' ')}`)('rows');
        const rows = await graph.query(queryQl(type, {
            where: { _or: columns.map(c => ({ [c]: { _in: variants } })) }, limit: 5000,
        })).then(r => r.data?.rows ?? []);
        for (const row of rows) for (const col of columns) {
            for (const v of referenceVariants(row[col], bucket)) if (wanted.has(v)) found.add(v);
        }
    }
    return found;
}

async function objectExists(key) {
    try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key })); return true; }
    catch (e) { if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return false; throw e; }
}

const moveObject = async (from, to) => {
    await s3.send(new CopyObjectCommand({ Bucket: BUCKET(), CopySource: copySource(from), Key: to }));
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: from }));
};

/**
 * @returns {{processed:number, failed:number, skipped:number, changed:number, remaining:number}}
 * `changed` = rows that actually left their status this call. The page loops while remaining > 0 AND changed > 0,
 * so rows that keep failing (or collide on restore) cannot make it loop forever.
 */
export async function runAction({ action, ids, prefix, user }) {
    const actor = user._id;
    const nowIso = () => new Date().toISOString();
    const tally = { processed: 0, failed: 0, skipped: 0 };
    let scope;
    let before = 0;

    if (action === 'quarantine') {
        scope = { ids, prefix, status: 'orphan' };
        before = await remaining(scope);
        const batch = await pickBatch(scope);
        const eligible = [];
        for (const r of batch) {
            if (!isCleanable(r.object_key)) { await setRow(r._id, { status: 'excluded', note: 'Outside the cleanable scope — protected.', acted_by: actor, acted_at: nowIso() }); tally.skipped++; continue; }
            if (Date.now() - new Date(r.last_modified).getTime() < minAgeMs(r.object_key)) { tally.skipped++; await setRow(r._id, { status: 'excluded', note: 'Too recent.', acted_by: actor, acted_at: nowIso() }); continue; }
            eligible.push(r);
        }
        // Re-check against the DB right now: a file can become referenced after the scan.
        const referenced = eligible.length ? await findReferencedKeys(eligible.map(r => r.object_key)) : new Set();
        await mapPool(eligible, async (r) => {
            if (referenced.has(r.object_key)) {
                tally.skipped++;
                return setRow(r._id, { status: 'excluded', note: 'Referenced by the database since the scan.', acted_by: actor, acted_at: nowIso() });
            }
            try {
                const to = quarantineKeyOf(r.object_key);
                await moveObject(r.object_key, to);
                await setRow(r._id, { status: 'quarantined', quarantine_key: to, note: null, acted_by: actor, acted_at: nowIso() });
                tally.processed++;
            } catch (err) {
                tally.failed++;
                await setRow(r._id, { note: `Quarantine failed: ${describeError(err)}`.slice(0, 500) }).catch(() => {});
            }
        });
    } else if (action === 'restore') {
        scope = { ids, prefix, status: 'quarantined' };
        before = await remaining(scope);
        const batch = await pickBatch(scope);
        await mapPool(batch, async (r) => {
            try {
                if (!r.quarantine_key || !r.quarantine_key.startsWith('to-delete/')) throw new Error('missing quarantine key');
                if (await objectExists(r.object_key)) {
                    tally.skipped++;
                    return setRow(r._id, { note: 'Not restored: an object already exists at the original key.' });
                }
                await moveObject(r.quarantine_key, r.object_key);
                await setRow(r._id, { status: 'restored', note: null, acted_by: actor, acted_at: nowIso() });
                tally.processed++;
            } catch (err) {
                tally.failed++;
                await setRow(r._id, { note: `Restore failed: ${describeError(err)}`.slice(0, 500) }).catch(() => {});
            }
        });
    } else if (action === 'purge') {
        // Only past the retention window, enforced here regardless of what the page sends.
        scope = { ids, prefix, status: 'quarantined', extraWhere: { acted_at: { _lt: purgeCutoff() } } };
        before = await remaining(scope);
        const batch = await pickBatch(scope);
        await mapPool(batch, async (r) => {
            try {
                if (!r.quarantine_key || !r.quarantine_key.startsWith('to-delete/')) throw new Error('missing quarantine key');
                await s3.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: r.quarantine_key }));
                await setRow(r._id, { status: 'purged', acted_by: actor, acted_at: nowIso() });
                tally.processed++;
            } catch (err) {
                tally.failed++;
                await setRow(r._id, { note: `Purge failed: ${describeError(err)}`.slice(0, 500) }).catch(() => {});
            }
        });
    } else if (action === 'exclude' || action === 'include') {
        scope = { ids, prefix, status: action === 'exclude' ? 'orphan' : 'excluded' };
        before = await remaining(scope);
        const batch = await pickBatch(scope);
        await mapPool(batch, async (r) => {
            await setRow(r._id, action === 'exclude'
                ? { status: 'excluded', note: 'Excluded manually.', acted_by: actor, acted_at: nowIso() }
                : { status: 'orphan', note: null, acted_by: actor, acted_at: nowIso() });
            tally.processed++;
        });
    } else {
        throw new Error(`Unknown action: ${action}`);
    }

    const after = await remaining(scope);
    return { ...tally, changed: Math.max(0, before - after), remaining: after };
}
