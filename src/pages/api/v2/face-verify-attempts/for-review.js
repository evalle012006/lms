// src/pages/api/v2/face-verify-attempts/for-review.js
// GET — latest face_verify_attempts row for one client+loan, for display during LDF disbursement review.
// Scoped like face-template.js: decision roles, in-scope clients only.
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { FACE_VERIFY_ATTEMPT_FIELDS, CLIENT_FACE_ENROLLMENT_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import { canDecideCI } from '@/lib/ci-scope';
import { resolveClientInScope } from '@/lib/client-scope';

const graph = new GraphProvider();
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS);
const CLIENT_TYPE = createGraphType('client', `_id firstName lastName profile faceEnrollPhotoKey`)('clients');
const ENROLLMENT_TYPE = createGraphType('client_face_enrollments', CLIENT_FACE_ENROLLMENT_FIELDS);

export default apiHandler({ get: forReview });

async function forReview(req, res) {
    const { clientId, loanId } = req.query;
    if (typeof clientId !== 'string' || !clientId) {
        return res.status(200).json({ success: false, message: 'clientId is required.' });
    }

    const user = await findUserById(req.auth?.sub);
    if (!user || !canDecideCI(user)) {
        return res.status(200).json({ success: false, message: 'Not allowed.' });
    }
    if (!(await resolveClientInScope(user, clientId))) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    const hasLoan = typeof loanId === 'string' && loanId;
    const where = hasLoan
        ? { _and: [{ client_id: { _eq: clientId } }, { loan_id: { _eq: loanId } }] }
        : { client_id: { _eq: clientId } };

    const [attempt] = await graph.query(
        queryQl(ATTEMPT_TYPE('attempts'), { where, order_by: [{ captured_at: 'desc' }], limit: 1 })
    ).then(r => r.data?.attempts ?? []);

    if (!attempt) {
        return res.status(200).json({ success: true, attempt: null });
    }

    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    // Show the reference this attempt was ACTUALLY checked against, not the client's current one.
    // NULL enrollment_id = no re-enrollment has happened yet, so the current reference is right.
    let enrollmentPhotoKey;
    if (attempt.enrollment_id) {
        const [row] = await graph.query(
            queryQl(ENROLLMENT_TYPE('enrollments'), { where: { _id: { _eq: attempt.enrollment_id } }, limit: 1 })
        ).then(r => r.data?.enrollments ?? []);
        enrollmentPhotoKey = row?.photo_key ?? client?.profile ?? null;
    } else {
        enrollmentPhotoKey = client?.faceEnrollPhotoKey ?? client?.profile ?? null;
    }

    // Was the reference re-enrolled for this loan? (explains a red mismatch row)
    const [recaptureRow] = await graph.query(
        queryQl(ENROLLMENT_TYPE('recaptures'), {
            where: { _and: [
                { client_id: { _eq: clientId } },
                ...(hasLoan ? [{ loan_id: { _eq: loanId } }] : []),
                { source: { _eq: 'disbursement_recapture' } },
            ] },
            order_by: [{ created_at: 'desc' }], limit: 1,
        })
    ).then(r => r.data?.recaptures ?? []);

    let recapture = null;
    if (recaptureRow) {
        const approver = recaptureRow.approved_by ? await findUserById(recaptureRow.approved_by) : null;
        recapture = {
            version: recaptureRow.version,
            reason: recaptureRow.reason,
            createdAt: recaptureRow.created_at,
            approvedByName: approver ? `${approver.firstName} ${approver.lastName}` : null,
        };
    }

    return res.status(200).json({
        success: true,
        attempt: { ...attempt, clientEnrollmentPhotoKey: enrollmentPhotoKey, recapture },
    });
}