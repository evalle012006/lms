// Staff-facing — uses the EXISTING apiHandler/jwtMiddleware (staff auth),
// not the client ones. Lives under pages/api/v2 like the rest of the staff API.

import moment from 'moment';

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { logEnrollmentAttempt, updateEnrollmentAttemptOutcome } from '@/services/enrollment-attempt-log';
import { generateUUID } from '@/lib/utils';
import { sendMobileAccessActivatedSMS } from '@/lib/sms-service';
import { normalizePhone, isValidPhilippineMobile } from '@/lib/phone-utils';
import { generateInitialPassword } from '@/lib/generate-initial-password';
import { isValidGovernmentId } from '@/lib/validation-utils';

const graph = new GraphProvider();

const REQUEST_TYPE = createGraphType('client_enrollment_requests', `
  _id client_id contact_number status
`)('client_enrollment_requests');

// _id is app-generated text — see the naming note in request-otp.js.
const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id client_id contact_number status
`)('client_accounts');

const CLIENT_STATUS_TYPE = createGraphType('client', `_id status governmentIdNumber`)('clients');

async function getActivationClient(clientId) {
    const [client] = await graph.query(
        queryQl(CLIENT_STATUS_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);
    return client ?? null;
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

            const activationClient = await getActivationClient(request.client_id);

            // Server-side enforcement, not just a UI grey-out — see the
            // architecture note in the codebase conventions on this.
            if (activationClient?.status !== 'active') {
                return res.status(400).json({ success: false, message: 'Only active clients can be granted mobile app access.' });
            }

            // A truthiness check alone doesn't catch placeholder garbage like
            // "NA" — that specific value silently normalized to "+" and let a
            // client get an account with no usable phone identifier. Reject
            // properly here, not just in the staff UI.
            if (!isValidPhilippineMobile(request.contact_number)) {
                return res.status(400).json({
                    success: false,
                    message: `This request's contact number ("${request.contact_number}") is not a valid mobile number. Correct the client's contact info before approving.`,
                });
            }

            // Same reasoning as path 2 — with SMS off, this is the only way
            // this client ever gets a working credential.
            const { plain: initialPassword, hash: passwordHash } = generateInitialPassword();

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
                        password_hash: passwordHash,
                        password_set_at: moment().toISOString(),
                        password_is_temporary: true,
                    }]
                })
            );

            await updateEnrollmentAttemptOutcome(requestId, { outcome: 'approved', reviewedByUserId: staffUserId });

            return res.status(200).json({
                success: true,
                initialPassword,
                // Not blocking — the account is still valid via phone login —
                // but worth telling staff so they know password-via-ID won't
                // work for this client until their record is updated.
                warning: isValidGovernmentId(activationClient?.governmentIdNumber)
                    ? undefined
                    : 'This client has no valid government ID on file — they can still log in with their phone number, but not an ID number.',
            });
        }

        // Path 2: direct staff activation, no pending request involved.
        if (clientId && contactNumber) {
            const activationClient = await getActivationClient(clientId);

            if (activationClient?.status !== 'active') {
                return res.status(400).json({ success: false, message: 'Only active clients can be granted mobile app access.' });
            }

            // This is the actual fix for the "NA" contact number bug: the old
            // check was `if (!client.contactNumber)`, which only catches
            // null/empty — "NA" is a non-empty string, so it passed straight
            // through, normalized to the garbage value "+", and got stored as
            // this client's account contact_number. Validate the real shape
            // instead of just truthiness.
            if (!isValidPhilippineMobile(contactNumber)) {
                return res.status(400).json({
                    success: false,
                    message: `This client's contact number ("${contactNumber}") is not a valid mobile number. Update their contact info before enabling mobile access.`,
                });
            }

            // SMS-based OTP isn't in use, so this is the ONLY way a client
            // ever gets a working credential — generated here, returned
            // once below for staff to relay in person (verbally, or on a
            // printed slip), never sent anywhere electronically.
            const { plain: initialPassword, hash: passwordHash } = generateInitialPassword();

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
                        password_hash: passwordHash,
                        password_set_at: moment().toISOString(),
                        password_is_temporary: true,
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
            // activation that already succeeded above. Currently a no-op
            // with SMS off (sendSMS just logs and returns false), left in
            // place so it resumes working automatically if SMS is ever
            // turned back on — it is NOT how the client learns their
            // password today, that's the returned initialPassword below.
            try {
                await sendMobileAccessActivatedSMS({ contactNumber, firstName: firstName || 'there' });
            } catch (err) {
                console.error('Failed to send activation SMS:', err);
            }

            return res.status(200).json({
                success: true,
                initialPassword,
                warning: isValidGovernmentId(activationClient?.governmentIdNumber)
                    ? undefined
                    : 'This client has no valid government ID on file — they can still log in with their phone number, but not an ID number.',
            });
        }

        return res.status(400).json({ success: false, message: 'Provide either requestId (path 3) or clientId + contactNumber (path 2)' });

    } catch (error) {
        console.error('mobile-enrollment approve error:', error);
        return res.status(500).json({ success: false, message: 'Failed to activate mobile access' });
    }
}