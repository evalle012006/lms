// src/pages/api/v2/clients/enroll-face.js
// POST { clientId, faceTemplate, faceEnrolledAt, livenessScore }
// Used at disbursement when a client has no face template at all — this
// capture becomes their enrollment, not a verification-against-existing-template.
import { apiHandler }                         from '@/services/api-handler';
import { GraphProvider }                      from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { CLIENT_FIELDS }                      from '@/lib/graph.fields';
import { findUserById }                       from '@/lib/graph.functions';
import { canDecideCI }                        from '@/lib/ci-scope';
import { resolveClientInScope }               from '@/lib/client-scope';
import { logAudit }                           from '@/lib/audit';
import moment from 'moment';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');
const CLIENT_CHECK_TYPE = createGraphType('client', '_id branchId faceTemplate')('clients');

export default apiHandler({ post: enrollClientFace });

async function enrollClientFace(req, res) {
    const { clientId, faceTemplate, faceEnrolledAt, livenessScore } = req.body;
    if (typeof clientId !== 'string' || !clientId || !faceTemplate) {
        return res.status(200).json({ success: false, message: 'clientId and faceTemplate required.' });
    }
    if (!Array.isArray(faceTemplate) || faceTemplate.length !== 128 || !faceTemplate.every(Number.isFinite)) {
        return res.status(200).json({ success: false, message: 'Invalid face template.' });
    }
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });
    if (!canDecideCI(currentUser)) {
        return res.status(200).json({ success: false, message: 'You are not allowed to enroll a face template.' });
    }

    if (!(await resolveClientInScope(currentUser, clientId))) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    const [client] = await graph.query(
        queryQl(CLIENT_CHECK_TYPE, { where: { _id: { _eq: clientId } }, limit: 1 })
    ).then(r => r.data?.clients ?? []);
    // Enrollment only: this endpoint must never replace an existing template
    if (client.faceTemplate) {
        return res.status(200).json({ success: false, message: 'This client already has a face template on file.' });
    }

    await graph.mutation(
        updateQl(CLIENT_TYPE, {
            where: { _id: { _eq: clientId } },
            set: {
                faceTemplate:   JSON.stringify(faceTemplate),
                faceEnrolledAt: faceEnrolledAt || moment().toISOString(),
                livenessScore:  livenessScore != null ? livenessScore : null,
            },
        })
    );

    await logAudit(req, {
        action: 'CLIENT_FACE_ENROLLED_AT_DISBURSEMENT', category: 'DISBURSEMENT', severity: 'WARNING',
        entityType: 'client', entityId: clientId,
        description: `Face template enrolled at disbursement (no prior template) by ${currentUser.firstName} ${currentUser.lastName}`,
        metadata: { clientId },
    });

    return res.status(200).json({ success: true, message: 'Face enrolled and disbursement can proceed.' });
}