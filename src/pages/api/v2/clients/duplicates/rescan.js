// src/pages/api/v2/clients/duplicates/rescan.js
// POST — admin-triggered duplicate scan (the page's "Re-scan" button).
// Starts the scan in the background and returns at once; the page polls list.js for lastRun.

import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';
import { startDuplicateScan } from '@/lib/duplicate-clients-job';

export default apiHandler({ post: rescan });

async function rescan(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    // 200 + success:false, never 403 (403 triggers client-side logout).
    if (!currentUser?.root && currentUser?.role?.rep !== 1) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }
    const result = await startDuplicateScan({ trigger: 'manual', triggeredBy: currentUser._id, req });
    return res.status(200).json({ success: true, ...result });
}
