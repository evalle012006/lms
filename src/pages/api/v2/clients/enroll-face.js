// src/pages/api/v2/clients/enroll-face.js
// POST { clientId, faceTemplate, faceEnrolledAt, livenessScore, photoKey, loanId }
// First-time enrollment at disbursement, for a client with NO face template.
// Replacing an existing template is NOT allowed here — see clients/recapture-face.js.
import { apiHandler }                                   from '@/services/api-handler';
import { GraphProvider }                                from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl, updateQl } from '@/lib/graph/graph.util';
import { CLIENT_FACE_ENROLLMENT_FIELDS, FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';
import { findUserById }                                 from '@/lib/graph.functions';
import { canDecideCI }                                  from '@/lib/ci-scope';
import { resolveClientInScope }                         from '@/lib/client-scope';
import { logAudit }                                     from '@/lib/audit';
import { generateUUID }                                 from '@/lib/utils';
import { sanitizeLiveness, sanitizeEnrolledAt }         from '@/lib/face-recapture-utils';

const graph = new GraphProvider();
const CLIENT_FACE_TYPE = createGraphType('client', '_id branchId firstName lastName faceTemplate');
const ENROLLMENT_TYPE  = createGraphType('client_face_enrollments', CLIENT_FACE_ENROLLMENT_FIELDS);
const ATTEMPT_TYPE     = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS);

export default apiHandler({ post: enrollClientFace });

const fail = (res, message) => res.status(200).json({ success: false, message });

async function enrollClientFace(req, res) {
    const { clientId, faceTemplate, faceEnrolledAt, livenessScore, photoKey, loanId } = req.body;
    if (typeof clientId !== 'string' || !clientId || !faceTemplate) {
        return fail(res, 'clientId and faceTemplate required.');
    }
    if (!Array.isArray(faceTemplate) || faceTemplate.length !== 128 || !faceTemplate.every(Number.isFinite)) {
        return fail(res, 'Invalid face template.');
    }
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return fail(res, 'User not found.');
    if (!canDecideCI(currentUser)) return fail(res, 'You are not allowed to enroll a face template.');

    if (!(await resolveClientInScope(currentUser, clientId))) return fail(res, 'Client not found.');

    const { clients, enrollments } = await graph.query(
        queryQl(CLIENT_FACE_TYPE('clients'), { where: { _id: { _eq: clientId } }, limit: 1 }),
        queryQl(ENROLLMENT_TYPE('enrollments'), {
            where: { _and: [{ client_id: { _eq: clientId } }, { status: { _eq: 'active' } }] },
            limit: 1,
        })
    ).then(r => r.data);

    const client = clients?.[0];
    if (!client) return fail(res, 'Client not found.');
    // Enrollment only: this endpoint must never replace an existing template
    if (client.faceTemplate || enrollments?.length) {
        return fail(res, 'This client already has a face template on file.');
    }

    const enrollmentId = generateUUID();
    // Never trust client-supplied values that land in typed columns
    const enrolledAt   = sanitizeEnrolledAt(faceEnrolledAt);
    const liveness     = sanitizeLiveness(livenessScore);
    const safePhotoKey = typeof photoKey === 'string' && photoKey ? photoKey : null;

    const ml = [];
    const add = (fn) => ml.push(fn(`bulk_${ml.length}`));
    add(a => insertQl(ENROLLMENT_TYPE(a), { objects: [{
        _id: enrollmentId, client_id: clientId, version: 1, status: 'active',
        source: 'disbursement_first',
        face_template: JSON.stringify(faceTemplate),
        photo_key: safePhotoKey,
        liveness_score: liveness,
        enrolled_at: enrolledAt,
        loan_id: loanId ?? null,
        branch_id: client.branchId ?? null,
        captured_by: currentUser._id,
        approved_by: currentUser._id,
    }] }));
    add(a => updateQl(CLIENT_FACE_TYPE(a), {
        where: { _id: { _eq: clientId } },
        set: {
            faceTemplate:   JSON.stringify(faceTemplate),
            faceEnrolledAt: enrolledAt,
            livenessScore:  liveness,
            ...(safePhotoKey ? { faceEnrollPhotoKey: safePhotoKey } : {}),
        },
    }));
    add(a => updateQl(ATTEMPT_TYPE(a), {
        where: { _and: [{ client_id: { _eq: clientId } }, { enrollment_id: { _is_null: true } }] },
        set: { enrollment_id: enrollmentId },
    }));
    await graph.mutation(...ml); // one request = one transaction

    await logAudit(req, {
        action: 'CLIENT_FACE_ENROLLED_AT_DISBURSEMENT', category: 'BIOMETRIC', severity: 'WARNING',
        entityType: 'client', entityId: clientId, clientId,
        description: `Face enrolled at disbursement (no prior template) for ${client.firstName} ${client.lastName} by ${currentUser.firstName} ${currentUser.lastName}`,
        branchId: client.branchId,
        userId: currentUser._id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        afterData: { version: 1, photoKey: safePhotoKey },
        metadata: { clientId, loanId: loanId ?? null, enrollmentId },
    });

    return res.status(200).json({ success: true, message: 'Face enrolled and disbursement can proceed.' });
}