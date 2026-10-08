import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id client_id status
`)('client_accounts');

export default apiHandler({ post: reactivate });

async function reactivate(req, res) {
    try {
        const { clientId } = req.body;
        if (!clientId) {
            return res.status(400).json({ success: false, message: 'clientId is required' });
        }

        const [account] = await graph.query(
            queryQl(CLIENT_ACCOUNT_TYPE, { where: { client_id: { _eq: clientId } } })
        ).then(r => r.data?.client_accounts ?? []);

        if (!account) {
            return res.status(404).json({ success: false, message: 'No mobile account found for this client' });
        }

        await graph.mutation(
            updateQl(CLIENT_ACCOUNT_TYPE, {
                set: { status: 'active', failed_otp_attempts: 0, otp_locked_until: null },
                where: { _id: { _eq: account._id } }
            })
        );

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('mobile-enrollment reactivate error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reactivate account' });
    }
}