import moment from 'moment';

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { updateEnrollmentAttemptOutcome } from '@/services/enrollment-attempt-log';

const graph = new GraphProvider();

const REQUEST_TYPE = createGraphType('client_enrollment_requests', `
  _id status
`)('client_enrollment_requests');

export default apiHandler({
    post: reject
});

async function reject(req, res) {
    try {
        const staffUserId = req.auth?.sub;
        const { requestId, reason } = req.body;

        if (!requestId || !reason) {
            return res.status(400).json({ success: false, message: 'requestId and reason are required' });
        }

        const [request] = await graph.query(
            queryQl(REQUEST_TYPE, { where: { _id: { _eq: requestId }, status: { _eq: 'pending' } } })
        ).then(r => r.data?.client_enrollment_requests ?? []);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found or already reviewed' });
        }

        await graph.mutation(
            updateQl(REQUEST_TYPE, {
                set: {
                    status: 'rejected',
                    reviewed_by_user_id: staffUserId,
                    reviewed_at: moment().toISOString(),
                    rejection_reason: reason,
                },
                where: { _id: { _eq: requestId } }
            })
        );

        await updateEnrollmentAttemptOutcome(requestId, { outcome: 'rejected', reviewedByUserId: staffUserId, detail: reason });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('mobile-enrollment reject error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reject request' });
    }
}