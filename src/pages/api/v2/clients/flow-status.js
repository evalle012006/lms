// src/pages/api/v2/clients/flow-status.js
import { apiHandler } from '@/services/api-handler';
import { findTemporaryLoanApplications } from '@/lib/graph.functions';

export default apiHandler({ get: getFlowStatus });

async function getFlowStatus(req, res) {
    const { clientIds } = req.query;

    if (!clientIds) {
        return res.status(200).json({ success: true, statusMap: {} });
    }

    const ids = String(clientIds).split(',').map(id => id.trim()).filter(Boolean);

    if (ids.length === 0) {
        return res.status(200).json({ success: true, statusMap: {} });
    }

    // Only need enough fields to determine which client id is referenced —
    // no need to pull the full TEMP_LOAN_APP_FIELDS set for this check.
    const apps = await findTemporaryLoanApplications(
        {
            status: { _eq: 'promoted' },
            _or: [
                { promotedClientId: { _in: ids } },
                { existingClientId: { _in: ids } },
            ],
        },
        `_id promotedClientId existingClientId`
    );

    const statusMap = {};
    ids.forEach(id => { statusMap[id] = false; });

    apps.forEach(app => {
        const matchedId = app.promotedClientId || app.existingClientId;
        if (matchedId && ids.includes(matchedId)) {
            statusMap[matchedId] = true;
        }
    });

    res.status(200).json({ success: true, statusMap });
}