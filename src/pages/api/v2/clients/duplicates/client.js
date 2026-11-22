// src/pages/api/v2/clients/duplicates/client.js
// GET ?clusterId=...&clientId=...  — the full client record behind "View profile" (shown in ClientDetailPage's modal).
// The client must be a member of that stored duplicate group AND sit in a branch the caller may see (admins: all).
// Records of other branches are available through Compare profiles only. Biometric and QR fields are never returned.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { CLIENT_FIELDS } from '@/lib/graph.fields';
import { resolveDuplicateScope } from '@/lib/duplicate-scope';

const graph = new GraphProvider();
const SENSITIVE = /^(faceTemplate|faceEnrollPhotoKey|biometric\w*|qr\w*|livenessScore)$/;
const SAFE_FIELDS = CLIENT_FIELDS.split('\n').map(l => l.trim()).filter(f => f && !SENSITIVE.test(f)).join('\n');
const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', `_id members`)('clusters');
const CLIENT_TYPE = createGraphType('client', SAFE_FIELDS)('people');

export default apiHandler({ get: getClient });

async function getClient(req, res) {
    const user = await findUserById(req.auth.sub);
    const access = await resolveDuplicateScope(user);
    if (!access.level) return res.status(200).json({ success: false, message: 'Insufficient permissions.' });

    const { clusterId, clientId } = req.query;
    if (!clusterId || !clientId) return res.status(200).json({ success: false, message: 'clusterId and clientId are required.' });

    const cluster = await graph.query(queryQl(CLUSTER_TYPE, { where: { _id: { _eq: String(clusterId) } }, limit: 1 }))
        .then(r => r.data?.clusters?.[0]);
    const member = cluster?.members?.find(m => m._id === clientId);
    if (!member) return res.status(200).json({ success: false, message: 'Client not found in this group.' });
    if (access.branchIds && !access.branchIds.includes(member.branchId)) {
        return res.status(200).json({ success: false, message: 'This client belongs to another branch. Use Compare profiles to see their details.' });
    }

    const client = await graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _eq: String(clientId) } }, limit: 1 }))
        .then(r => r.data?.people?.[0]);
    if (!client) return res.status(200).json({ success: false, message: 'Client not found.' });
    return res.status(200).json({ success: true, client });
}
