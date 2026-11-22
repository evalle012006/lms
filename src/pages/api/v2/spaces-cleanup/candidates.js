// src/pages/api/v2/spaces-cleanup/candidates.js
// GET ?status=orphan|quarantined|excluded&prefix=&page=&limit=  — paginated candidates with 15-minute preview URLs. Root only.
import { apiHandler } from '@/services/api-handler';
import { requireRoot, listCandidates } from '@/lib/spaces-cleanup';

const STATUSES = ['orphan', 'quarantined', 'excluded', 'restored', 'purged'];

export default apiHandler({ get: candidates });

async function candidates(req, res) {
    const user = await requireRoot(req, res);
    if (!user) return;
    const status = STATUSES.includes(req.query.status) ? req.query.status : 'orphan';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const prefix = typeof req.query.prefix === 'string' && req.query.prefix ? req.query.prefix : undefined;
    return res.status(200).json({ success: true, ...(await listCandidates({ status, prefix, page, limit })) });
}
