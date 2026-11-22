// src/pages/api/v2/spaces-cleanup/scan.js
// POST — start a manual orphan scan in the background. Root only. The page polls overview.js for progress.
import { apiHandler } from '@/services/api-handler';
import { requireRoot, startSpacesScan } from '@/lib/spaces-cleanup';

export default apiHandler({ post: scan });

async function scan(req, res) {
    const user = await requireRoot(req, res);
    if (!user) return;
    const result = await startSpacesScan({ triggeredBy: user._id });
    if (!result.started) {
        return res.status(200).json({ success: false, message: 'A scan is already running.' });
    }
    return res.status(200).json({ success: true, runId: result.runId });
}
