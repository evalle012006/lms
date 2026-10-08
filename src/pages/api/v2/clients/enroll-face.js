// src/pages/api/v2/clients/enroll-face.js
// POST { clientId, faceTemplate, faceEnrolledAt, livenessScore }
// Used at disbursement when a client has no face template at all — this
// capture becomes their enrollment, not a verification-against-existing-template.
import { apiHandler }                         from '@/services/api-handler';
import { GraphProvider }                      from '@/lib/graph/graph.provider';
import { createGraphType, updateQl }          from '@/lib/graph/graph.util';
import { CLIENT_FIELDS }                      from '@/lib/graph.fields';
import { findUserById }                       from '@/lib/graph.functions';
import { logAudit }                           from '@/lib/audit';
import moment from 'moment';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');

export default apiHandler({ post: enrollClientFace });

async function enrollClientFace(req, res) {
    const { clientId, faceTemplate, faceEnrolledAt, livenessScore } = req.body;
    if (!clientId || !faceTemplate) {
        return res.status(200).json({ success: false, message: 'clientId and faceTemplate required.' });
    }
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

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