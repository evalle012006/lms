import { apiHandler } from '@/services/api-handler';
import { loadCsfEnabled } from '@/lib/csf-config-server';

export default apiHandler({ get: getCsfConfig });

async function getCsfConfig(req, res) {
    const { groupId } = req.query;
    if (!groupId) {
        return res.status(200).json({ success: false, message: 'groupId required.' });
    }
    const csfEnabled = await loadCsfEnabled(groupId);
    return res.status(200).json({ success: true, csfEnabled });
}