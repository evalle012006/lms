import moment from 'moment';

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateInitialPassword } from '@/lib/generate-initial-password';

const graph = new GraphProvider();

const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id status
`)('client_accounts');

export default apiHandler({ post: resetPassword });

// Staff-mediated reset — this exists specifically because self-service
// "forgot password" would need SMS or email to verify the request, and
// neither is available. Staff resets in person the same way they'd
// activate access in the first place (generate-and-relay, never staff
// picking/typing a password themselves).
async function resetPassword(req, res) {
    try {
        const staffUserId = req.auth?.sub;
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

        const { plain: newPassword, hash: passwordHash } = generateInitialPassword();

        await graph.mutation(
            updateQl(CLIENT_ACCOUNT_TYPE, {
                set: {
                    password_hash: passwordHash,
                    password_set_at: moment().toISOString(),
                    failed_password_attempts: 0,
                    password_is_temporary: true,
                },
                where: { _id: { _eq: account._id } }
            })
        );

        return res.status(200).json({ success: true, newPassword });

    } catch (error) {
        console.error('mobile-enrollment reset-password error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
}