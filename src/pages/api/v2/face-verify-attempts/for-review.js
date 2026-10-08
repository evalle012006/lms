// src/pages/api/v2/face-verify-attempts/for-review.js
// GET — latest face_verify_attempts row for one client+loan, for display
// during LDF disbursement review. Unlike list.js, this is NOT root-gated:
// any authenticated user driving the disbursement modal needs to see it,
// not just admins auditing after the fact.
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS);
const CLIENT_TYPE = createGraphType('client', `_id firstName lastName profile faceEnrollPhotoKey`)('clients');

export default apiHandler({ get: forReview });

async function forReview(req, res) {
    const { clientId, loanId } = req.query;
    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId is required.' });
    }

    const where = loanId
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

    return res.status(200).json({
        success: true,
        attempt: {
            ...attempt,
            clientEnrollmentPhotoKey: client?.faceEnrollPhotoKey ?? client?.profile ?? null,
        },
    });
}