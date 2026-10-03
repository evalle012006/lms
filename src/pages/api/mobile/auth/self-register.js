import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { logEnrollmentAttempt } from '@/services/enrollment-attempt-log';
import { generateUUID } from '@/lib/utils';
import { normalizePhone } from '@/lib/phone-utils';

const graph = new GraphProvider();

const ENROLLMENT_REQUEST_TYPE = createGraphType('client_enrollment_requests', `
  _id status
`)('client_enrollment_requests');

export default clientApiHandler({
    post: selfRegister
});

// Deliberately does NOT auto-approve on a face-match score, even though
// client.faceTemplate exists for clients who went through the LAF flow.
// A false-accept here is an account-takeover vector (attacker gets standing
// access, not a one-time transaction); LAF's face check is lower-stakes by
// comparison. Auto-approve can be revisited once faceMatchThreshold has a
// track record for this specific use case — start with a human reviewer.
async function selfRegister(req, res) {
    try {
        const {
            contactNumber, governmentIdType, governmentIdNumber,
            governmentIdPhotoKey, selfiePhotoKey,
        } = req.body;

        if (!contactNumber || !governmentIdType || !governmentIdNumber || !governmentIdPhotoKey || !selfiePhotoKey) {
            return res.status(400).json({ success: false, message: 'All identity verification fields are required' });
        }

        const requestId = generateUUID();

        await graph.mutation(
            insertQl(ENROLLMENT_REQUEST_TYPE, {
                objects: [{
                    _id: requestId,
                    method: 'self_registered_id_verified',
                    contact_number: normalizePhone(contactNumber),
                    government_id_type: governmentIdType,
                    government_id_number: governmentIdNumber,
                    government_id_photo_key: governmentIdPhotoKey,
                    selfie_photo_key: selfiePhotoKey,
                    status: 'pending',
                }]
            })
        );

        await logEnrollmentAttempt({
            method: 'self_registered_id_verified',
            outcome: 'pending_review',
            contactNumber,
            enrollmentRequestId: requestId,
        });

        return res.status(200).json({
            success: true,
            message: 'Your request has been submitted for review. This usually takes 1–2 business days.'
        });

    } catch (error) {
        console.error('self-register error:', error);
        return res.status(500).json({ success: false, message: 'Failed to submit registration' });
    }
}