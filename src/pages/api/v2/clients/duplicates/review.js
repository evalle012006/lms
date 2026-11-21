// src/pages/api/v2/clients/duplicates/review.js
// POST { clusterId, decision: 'confirmed' | 'not_duplicate' | 'clear', note }
// Admin only (rep=1 / root). Stores the reviewer's decision on a stored duplicate group.

import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';
import { reviewCluster } from '@/lib/duplicate-clients-store';

export default apiHandler({ post: review });

async function review(req, res) {
    const user = await findUserById(req.auth.sub);
    // 200 + success:false, never 403 (403 triggers client-side logout).
    if (!user?.root && user?.role?.rep !== 1) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }
    const { clusterId, decision, note } = req.body || {};
    if (typeof clusterId !== 'string' || !clusterId) {
        return res.status(200).json({ success: false, message: 'clusterId is required.' });
    }
    const result = await reviewCluster({ clusterId, decision, note, user, req });
    return res.status(200).json(result);
}
