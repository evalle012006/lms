// src/pages/api/v2/clients/duplicates/not-same.js
// POST { clusterId, clientId, note? }
// Root only (lib/duplicate-access.js). "This record is a DIFFERENT person from the rest of the group."

import { apiHandler } from '@/services/api-handler';
import { canManageDuplicates } from '@/lib/duplicate-access';
import { findUserById } from '@/lib/graph.functions';
import { markNotSamePerson } from '@/lib/duplicate-clients-store';

export default apiHandler({ post: notSame });

async function notSame(req, res) {
    const user = await findUserById(req.auth.sub);
    // 200 + success:false, never 403 (403 triggers client-side logout).
    if (!canManageDuplicates(user)) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }
    const { clusterId, clientId, note } = req.body || {};
    if (typeof clusterId !== 'string' || !clusterId || typeof clientId !== 'string' || !clientId) {
        return res.status(200).json({ success: false, message: 'clusterId and clientId are required.' });
    }
    const result = await markNotSamePerson({ clusterId, clientId, note, user, req });
    return res.status(200).json(result);
}
