import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id contact_number status enrollment_method verified_at last_login_at
`)('client_accounts');

const REQUEST_TYPE = createGraphType('client_enrollment_requests', `
  _id status created_at
`)('client_enrollment_requests');

export default apiHandler({ get: status });

async function status(req, res) {
    try {
        const { clientId } = req.query;
        if (!clientId) {
            return res.status(400).json({ success: false, message: 'clientId is required' });
        }

        const [account] = await graph.query(
            queryQl(CLIENT_ACCOUNT_TYPE, { where: { client_id: { _eq: clientId } } })
        ).then(r => r.data?.client_accounts ?? []);

        if (account) {
            return res.status(200).json({ success: true, state: account.status, account });
        }

        // No account yet — check whether there's a pending self-registration
        // request tied to this client, so the panel can show that instead of
        // just "not activated".
        const [pendingRequest] = await graph.query(
            queryQl(REQUEST_TYPE, { where: { client_id: { _eq: clientId }, status: { _eq: 'pending' } } })
        ).then(r => r.data?.client_enrollment_requests ?? []);

        if (pendingRequest) {
            return res.status(200).json({ success: true, state: 'pending_review', request: pendingRequest });
        }

        return res.status(200).json({ success: true, state: 'not_enrolled' });

    } catch (error) {
        console.error('mobile-enrollment status error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load mobile access status' });
    }
}