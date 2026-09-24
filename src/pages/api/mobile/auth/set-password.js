import moment from 'moment';
import bcrypt from 'bcryptjs';

import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id password_hash
`)('client_accounts');

const MIN_PASSWORD_LENGTH = 6;

export default clientApiHandler({ post: setPassword });

async function setPassword(req, res) {
    try {
        const { clientAccountId } = req.auth;
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
        }

        const [account] = await graph.query(
            queryQl(CLIENT_ACCOUNT_TYPE, { where: { _id: { _eq: clientAccountId } } })
        ).then(r => r.data?.client_accounts ?? []);

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        // Only require the current password when one already exists —
        // first-time setup (coming from an OTP login) has nothing to check
        // against. Changing an existing password does require it, even
        // though the caller already holds a valid session — defense in
        // depth against a borrowed/unlocked device permanently taking over
        // password access.
        if (account.password_hash) {
            if (!currentPassword || !bcrypt.compareSync(currentPassword, account.password_hash)) {
                return res.status(401).json({ success: false, code: 'INCORRECT_CURRENT_PASSWORD', message: 'Current password is incorrect.' });
            }
        }

        const newHash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));

        await graph.mutation(
            updateQl(CLIENT_ACCOUNT_TYPE, {
                set: {
                    password_hash: newHash,
                    password_set_at: moment().toISOString(),
                    failed_password_attempts: 0,
                    password_is_temporary: false,
                },
                where: { _id: { _eq: clientAccountId } }
            })
        );

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('set-password error:', error);
        return res.status(500).json({ success: false, message: 'Failed to set password' });
    }
}