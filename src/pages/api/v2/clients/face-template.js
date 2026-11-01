// src/pages/api/v2/clients/face-template.js
// GET ?clientId=xxx
// Returns ONE client's stored face template to an approver doing disbursement verification.
// CLIENT_FIELDS no longer carries faceTemplate, so this is the only way to read it.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { canDecideCI } from '@/lib/ci-scope';
import { resolveClientInScope } from '@/lib/client-scope';

const graph = new GraphProvider();
const CLIENT_FACE_TYPE = createGraphType('client', '_id faceTemplate')('clients');

export default apiHandler({ get: getFaceTemplate });

async function getFaceTemplate(req, res) {
    const { clientId } = req.query;
    if (typeof clientId !== 'string' || !clientId) {
        return res.status(200).json({ success: false, message: 'clientId required.' });
    }

    const user = await findUserById(req.auth?.sub);
    if (!user || !canDecideCI(user)) {
        return res.status(200).json({ success: false, message: 'Not allowed.' });
    }

    if (!(await resolveClientInScope(user, clientId))) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    const [client] = await graph.query(
        queryQl(CLIENT_FACE_TYPE, { where: { _id: { _eq: clientId } }, limit: 1 })
    ).then(r => r.data?.clients ?? []);

    return res.status(200).json({ success: true, faceTemplate: client?.faceTemplate || null });
}