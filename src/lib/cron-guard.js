// src/lib/cron-guard.js
// Shared wrapper for the Hasura cron endpoints (pages/api/v2/cronjobs/*).
//  - Lock: a row in cron_runs with status 'running'; a partial unique index allows one per job, so overlapping
//    triggers (or the 3 app containers) cannot run the same job twice. A 'running' row older than staleMinutes
//    is treated as a crashed run and expired.
//  - Result: every run records status/stats/error, so a failed background job is visible instead of silent.
//  - Fail-open: if the guard table is missing/unreachable the job still runs (same as before this guard existed).
// Requires migration database/postgre-migrations/010_cron_runs.sql.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { withRetry, describeError } from '@/lib/retry';

const graph = new GraphProvider();
const RUN_TYPE = createGraphType('cron_runs', '_id');

const CONFLICT = /unique|duplicate key|constraint/i;

export const triggerOf = (req) => (req?.headers?.['x-webhook-api-key'] ? 'cron' : 'manual');

/** Expire crashed runs, then take the lock. Resolves { started, runId }. */
export async function beginCronRun(jobName, { trigger = 'cron', staleMinutes = 30 } = {}) {
    try {
        const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
        await graph.mutation(updateQl(RUN_TYPE('expire'), {
            set: { status: 'failed', finished_at: new Date().toISOString(), error: `stale: no finish after ${staleMinutes} min` },
            where: { job_name: { _eq: jobName }, status: { _eq: 'running' }, started_at: { _lt: cutoff } },
        }));

        const runId = generateUUID();
        const res = await graph.mutation(insertQl(RUN_TYPE('run'), {
            objects: [{ _id: runId, job_name: jobName, status: 'running', trigger }],
        }));
        if (res?.errors?.length) throw Object.assign(new Error(res.errors.map(e => e.message).join('; ')), { graphQLErrors: res.errors });
        return { started: true, runId };
    } catch (err) {
        if (CONFLICT.test(describeError(err))) return { started: false, reason: 'already_running' };
        console.warn(`[cron-guard] ${jobName}: guard unavailable, running unguarded: ${describeError(err)}`);
        return { started: true, runId: null };
    }
}

export async function finishCronRun(runId, { ok, stats = null, error = null }) {
    if (!runId) return;
    try {
        await withRetry(() => graph.mutation(updateQl(RUN_TYPE('finish'), {
            set: { status: ok ? 'success' : 'failed', finished_at: new Date().toISOString(), stats, error },
            where: { _id: { _eq: runId } },
        })));
    } catch (err) {
        console.warn(`[cron-guard] could not record result for run ${runId}: ${describeError(err)}`);
    }
}

/**
 * Handle one cron request.
 *   work()      → async; may return a stats object
 *   background  → true: answer 200 immediately and run work() after (long jobs); false: await it
 *   message     → success message returned to Hasura
 * Always answers 200 when skipped (already running) so Hasura does not retry.
 */
export async function handleCron(req, res, jobName, work, { background = false, staleMinutes = 30, message = 'done' } = {}) {
    const run = await beginCronRun(jobName, { trigger: triggerOf(req), staleMinutes });
    if (!run.started) {
        return res.status(200).json({ success: true, skipped: true, message: `${jobName} is already running.` });
    }

    const exec = async () => {
        try {
            const stats = (await work()) ?? null;
            await finishCronRun(run.runId, { ok: true, stats });
            return { ok: true, stats };
        } catch (err) {
            console.error(`[cron] ${jobName} failed:`, err);
            await finishCronRun(run.runId, { ok: false, error: describeError(err) });
            return { ok: false, err };
        }
    };

    if (background) {
        exec();
        return res.status(200).json({ success: true, message, runId: run.runId });
    }
    const out = await exec();
    if (!out.ok) return res.status(500).json({ success: false, message: describeError(out.err), runId: run.runId });
    return res.status(200).json({ success: true, message, runId: run.runId, stats: out.stats });
}
