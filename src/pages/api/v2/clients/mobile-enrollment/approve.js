// Staff-facing — uses the EXISTING apiHandler/jwtMiddleware (staff auth),
// not the client ones. Lives under pages/api/v2 like the rest of the staff API.

import moment from 'moment';

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { logEnrollmentAttempt, updateEnrollmentAttemptOutcome } from '@/services/enrollment-attempt-log';
import { generateUUID } from '@/lib/utils';
import { sendMobileAccessActivatedSMS } from '@/lib/sms-service';
import { normalizePhone } from '@/lib/phone-utils';

const graph = new GraphProvider();

const REQUEST_TYPE = createGraphType('client_enrollment_requests', `
  _id client_id contact_number status
`)('client_enrollment_requests');

// _id is app-generated text — see the naming note in request-otp.js.
const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id client_id contact_number status
`)('client_accounts');

const CLIENT_STATUS_TYPE = createGraphType('client', `_id status`)('clients');

async function isClientActive(clientId) {
    const [client] = await graph.query(
        queryQl(CLIENT_STATUS_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);
    return client?.status === 'active';
}

export default apiHandler({
    post: approveOrActivate
});

async function approveOrActivate(req, res) {
    try {
        const staffUserId = req.auth?.sub; // set by the existing jwtMiddleware, same as every other v2 route
        const { requestId, clientId, contactNumber, firstName } = req.body;

        // Path 3: approving a pending self-registration request.
        if (requestId) {
            const [request] = await graph.query(
                queryQl(REQUEST_TYPE, { where: { _id: { _eq: requestId }, status: { _eq: 'pending' } } })
            ).then(r => r.data?.client_enrollment_requests ?? []);

            if (!request) {
                return res.status(404).json({ success: false, message: 'Request not found or already reviewed' });
            }
            if (!request.client_id) {
                return res.status(400).json({ success: false, message: 'This request is not linked to a client record yet — resolve identity first.' });
            }

            // Server-side enforcement, not just a UI grey-out — see the
            // architecture note in the codebase conventions on this.
            if (!(await isClientActive(request.client_id))) {
                return res.status(400).json({ success: false, message: 'Only active clients can be granted mobile app access.' });
            }

            await graph.mutation(
                updateQl(REQUEST_TYPE, {
                    set: { status: 'approved', reviewed_by_user_id: staffUserId, reviewed_at: moment().toISOString() },
                    where: { _id: { _eq: requestId } }
                }),
                insertQl(CLIENT_ACCOUNT_TYPE, {
                    objects: [{
                        _id: generateUUID(),
                        client_id: request.client_id,
                        contact_number: normalizePhone(request.contact_number),
                        status: 'active',
                        enrollment_method: 'self_registered_id_verified',
                        verified_at: moment().toISOString(),
                    }]
                })
            );

            await updateEnrollmentAttemptOutcome(requestId, { outcome: 'approved', reviewedByUserId: staffUserId });

            return res.status(200).json({ success: true });
        }

        // Path 2: direct staff activation, no pending request involved.
        if (clientId && contactNumber) {
            if (!(await isClientActive(clientId))) {
                return res.status(400).json({ success: false, message: 'Only active clients can be granted mobile app access.' });
            }

            await graph.mutation(
                insertQl(CLIENT_ACCOUNT_TYPE, {
                    objects: [{
                        _id: generateUUID(),
                        client_id: clientId,
                        contact_number: normalizePhone(contactNumber),
                        status: 'active',
                        enrollment_method: 'staff_activated',
                        enrolled_by_user_id: staffUserId,
                        verified_at: moment().toISOString(),
                    }]
                })
            );

            await logEnrollmentAttempt({
                method: 'staff_activated',
                outcome: 'success',
                contactNumber,
                clientId,
                reviewedByUserId: staffUserId,
            });

            // Best-effort — a notification failure shouldn't undo the
            // activation that already succeeded above.
            try {
                await sendMobileAccessActivatedSMS({ contactNumber, firstName: firstName || 'there' });
            } catch (err) {
                console.error('Failed to send activation SMS:', err);
            }

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ success: false, message: 'Provide either requestId (path 3) or clientId + contactNumber (path 2)' });

    } catch (error) {
        console.error('mobile-enrollment approve error:', error);
        return res.status(500).json({ success: false, message: 'Failed to activate mobile access' });
    }
}