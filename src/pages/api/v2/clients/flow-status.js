// src/pages/api/v2/clients/flow-status.js
import { apiHandler } from '@/services/api-handler';
import { resolveClientFlowStatus } from '@/lib/graph.functions';

export default apiHandler({ get: getFlowStatus });

async function getFlowStatus(req, res) {
    const { clientIds } = req.query;

    if (!clientIds) {
        return res.status(200).json({ success: true, statusMap: {} });
    }

    const ids = String(clientIds).split(',').map(id => id.trim()).filter(Boolean);
    const statusMap = await resolveClientFlowStatus(ids);
    res.status(200).json({ success: true, statusMap });
}