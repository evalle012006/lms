// POST /api/v2/cronjobs/clean-up-stale-applications — nightly (Hasura cron, x-webhook-api-key).
// Cleans up stale prospect LAF applications (see src/lib/stale-applications-job.js).
//
// Safe rollout: the job only CHANGES data when STALE_APP_CLEANUP_LIVE=true. Otherwise it runs as a
// dry run and records what it would have done in cron_runs.stats. A caller can force either mode
// with { "dryRun": true|false } (body) or ?dryRun=; non-webhook callers must be root.

import { apiHandler } from '@/services/api-handler';
import { handleCron } from '@/lib/cron-guard';
import { findUserById } from '@/lib/graph.functions';
import { runStaleApplicationCleanup } from '@/lib/stale-applications-job';
import { runStaleClientCleanup } from '@/lib/stale-clients-job';

export default apiHandler({ post: clean });

const parseBool = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null);

async function clean(req, res) {
    const isWebhook = !!req.headers['x-webhook-api-key'];
    if (!isWebhook) {
        const user = await findUserById(req.auth?.sub);
        if (user?.root !== true) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
    }

    const explicit = parseBool(req.body?.dryRun) ?? parseBool(req.query?.dryRun);
    const dryRun = explicit ?? (process.env.STALE_APP_CLEANUP_LIVE !== 'true');

    return handleCron(
        req, res, 'clean-up-stale-applications',
        async () => {
            // clients first, so applications the client stage still needs are not wiped before it runs
            const caps = {};
            const wc = parseInt(req.body?.wipeCap ?? req.query?.wipeCap, 10);
            const ec = parseInt(req.body?.excludeCap ?? req.query?.excludeCap, 10);
            if (wc > 0) caps.wipeCap = wc;
            if (ec > 0) caps.excludeCap = ec;
            const clients = await runStaleClientCleanup({ dryRun, ...caps });
            const applications = await runStaleApplicationCleanup({ dryRun });
            return { dryRun, clients, applications };
        },
        { background: true, staleMinutes: 120, message: dryRun ? 'dry run: no data changed' : 'stale applications cleaned up' }
    );
}
