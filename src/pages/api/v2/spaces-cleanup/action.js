// src/pages/api/v2/spaces-cleanup/action.js
// POST { action: 'quarantine'|'restore'|'purge'|'exclude'|'include', ids?: string[], prefix?: string }
// Handles one batch (ACTION_BATCH objects) and returns { processed, failed, skipped, changed, remaining };
// the page calls it again while remaining > 0 and changed > 0. Root only.
import { apiHandler } from '@/services/api-handler';
import { requireRoot, runAction } from '@/lib/spaces-cleanup';
import { describeError } from '@/lib/retry';
import logger from '@/logger';

const ACTIONS = ['quarantine', 'restore', 'purge', 'exclude', 'include'];

export default apiHandler({ post: act });

async function act(req, res) {
    const user = await requireRoot(req, res);
    if (!user) return;

    const { action, ids, prefix } = req.body ?? {};
    if (!ACTIONS.includes(action)) return res.status(200).json({ success: false, message: 'Unknown action.' });
    const hasIds = Array.isArray(ids) && ids.length > 0 && ids.every(i => typeof i === 'string');
    const hasPrefix = typeof prefix === 'string' && prefix.length > 0;
    // Never act on "everything" by accident: the caller must name rows or a prefix group.
    if (!hasIds && !hasPrefix) return res.status(200).json({ success: false, message: 'Select rows or a prefix group.' });

    try {
        const result = await runAction({ action, ids: hasIds ? ids : undefined, prefix: hasIds ? undefined : prefix, user });
        logger.debug({ job: 'spaces-cleanup', action, by: user._id, ...result });
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        logger.error({ job: 'spaces-cleanup', action, error: describeError(err) });
        return res.status(200).json({ success: false, message: describeError(err) });
    }
}
