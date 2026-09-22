import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();

const ATTEMPT_TYPE = createGraphType('client_enrollment_attempts', `
  _id method outcome contact_number client_id enrollment_request_id detail reviewed_by_user_id
`)('client_enrollment_attempts');

export async function logEnrollmentAttempt({
    method, outcome, contactNumber, clientId = null,
    enrollmentRequestId = null, detail = null, reviewedByUserId = null,
}) {
    // Logging must never break the calling flow — a client shouldn't get a
    // 500 because an audit-log write failed. Swallow and report, don't throw.
    try {
        await graph.mutation(
            insertQl(ATTEMPT_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    method, outcome,
                    contact_number: contactNumber,
                    client_id: clientId,
                    enrollment_request_id: enrollmentRequestId,
                    detail,
                    reviewed_by_user_id: reviewedByUserId,
                }]
            })
        );
    } catch (err) {
        console.error('Failed to log enrollment attempt:', err);
    }
}

// Used by approve.js/reject.js to flip a self-registration's logged attempt
// row from 'pending_review' to its final outcome, rather than inserting a
// second row for the same request.
export async function updateEnrollmentAttemptOutcome(enrollmentRequestId, { outcome, reviewedByUserId, detail = null }) {
    try {
        await graph.mutation(
            updateQl(ATTEMPT_TYPE, {
                set: { outcome, reviewed_by_user_id: reviewedByUserId, detail },
                where: { enrollment_request_id: { _eq: enrollmentRequestId }, outcome: { _eq: 'pending_review' } }
            })
        );
    } catch (err) {
        console.error('Failed to update enrollment attempt outcome:', err);
    }
}