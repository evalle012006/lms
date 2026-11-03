import { apiHandler } from '@/services/api-handler';
import { findBranches } from '@/lib/graph.functions';
import { isOfflineModeActive } from '@/lib/offline-mode';

export default apiHandler({ get: getFaceVerifyMode });

async function getFaceVerifyMode(req, res) {
    const ids = String(req.query.branchIds ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
    if (ids.length === 0) return res.status(200).json({ success: true, modeMap: {} });

    const branches = await findBranches({ _id: { _in: ids } }, '_id skipClientFaceVerify skipClientFaceVerifyUntil');
    const modeMap = {};
    branches.forEach(b => { modeMap[b._id] = isOfflineModeActive(b); });
    return res.status(200).json({ success: true, modeMap });
}