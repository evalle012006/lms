// src/pages/api/v2/cronjobs/detect-duplicate-clients.js
// POST — nightly duplicate-client scan. Called by a Hasura cron trigger
// (x-webhook-api-key header, handled by apiHandler). Returns immediately;
// the scan runs in the background and is tracked in duplicate_scan_runs.

import { apiHandler } from '@/services/api-handler';
import { startDuplicateScan } from '@/lib/duplicate-clients-job';

export default apiHandler({ post: detect });

async function detect(req, res) {
    const result = await startDuplicateScan({ trigger: 'cron', req });
    return res.status(200).json({
        success: true,
        message: result.started ? 'Duplicate scan started.' : 'A duplicate scan is already running.',
        ...result,
    });
}
