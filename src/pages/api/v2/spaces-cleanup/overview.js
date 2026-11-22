// src/pages/api/v2/spaces-cleanup/overview.js
// GET — latest scan run (with live progress), counts per status, per-prefix breakdown, settings. Root only.
import { apiHandler } from '@/services/api-handler';
import { requireRoot, getOverview } from '@/lib/spaces-cleanup';

export default apiHandler({ get: overview });

async function overview(req, res) {
    const user = await requireRoot(req, res);
    if (!user) return;
    return res.status(200).json({ success: true, ...(await getOverview()) });
}
