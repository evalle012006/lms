import getConfig from 'next/config';
import moment from 'moment';
import bcrypt from 'bcryptjs';

const jwt = require('jsonwebtoken');

import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { normalizePhone } from '@/lib/phone-utils';
import { issueRefreshToken } from '@/services/refresh-token-service';
import { isPasswordLoginEnabled } from '@/lib/password-login-settings';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const MAX_PASSWORD_ATTEMPTS = 3;

const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id client_id status password_hash failed_password_attempts password_is_temporary
`)('client_accounts');

// `client` is legacy Mongo-migrated (camelCase), aliased to plural per
// codebase convention — see the same note in request-otp.js.
const CLIENT_TYPE = createGraphType('client', `_id governmentIdNumber status`)('clients');

export default clientApiHandler({ post: loginWithPassword });

async function loginWithPassword(req, res) {
    try {
        if (!(await isPasswordLoginEnabled())) {
            return res.status(403).json({ success: false, code: 'PASSWORD_LOGIN_DISABLED', message: 'Password login is not available. Please use SMS code.' });
        }

        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: 'identifier and password are required' });
        }

        // The identifier can be a phone number or a government ID number —
        // try phone first (the more common case, and free of an extra join).
        const normalizedPhone = normalizePhone(identifier);
        let [account] = await graph.query(
            queryQl(CLIENT_ACCOUNT_TYPE, { where: { contact_number: { _eq: normalizedPhone }, status: { _eq: 'active' } } })
        ).then(r => r.data?.client_accounts ?? []);

        if (!account) {
            // Not a phone match — try it as a government ID number instead.
            const [client] = await graph.query(
                queryQl(CLIENT_TYPE, { where: { governmentIdNumber: { _eq: identifier } } })
            ).then(r => r.data?.clients ?? []);

            if (client) {
                [account] = await graph.query(
                    queryQl(CLIENT_ACCOUNT_TYPE, { where: { client_id: { _eq: client._id }, status: { _eq: 'active' } } })
                ).then(r => r.data?.client_accounts ?? []);
            }
        }

        // Same response whether the identifier doesn't exist, the account
        // isn't active, or no password has been set — don't let the error
        // confirm which identifiers are valid to a caller probing them.
        if (!account || !account.password_hash) {
            return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Incorrect ID/phone number or password.' });
        }

        if (account.failed_password_attempts >= MAX_PASSWORD_ATTEMPTS) {
            return res.status(403).json({
                success: false,
                code: 'PASSWORD_LOCKED',
                message: 'Too many incorrect attempts. Please visit your branch to reset your password.',
            });
        }

        const matches = bcrypt.compareSync(password, account.password_hash);

        if (!matches) {
            const newAttemptCount = account.failed_password_attempts + 1;
            await graph.mutation(
                updateQl(CLIENT_ACCOUNT_TYPE, {
                    set: { failed_password_attempts: newAttemptCount },
                    where: { _id: { _eq: account._id } }
                })
            );

            if (newAttemptCount >= MAX_PASSWORD_ATTEMPTS) {
                return res.status(403).json({
                    success: false,
                    code: 'PASSWORD_LOCKED',
                    message: 'Too many incorrect attempts. Please visit your branch to reset your password.',
                });
            }

            const remaining = MAX_PASSWORD_ATTEMPTS - newAttemptCount;
            return res.status(401).json({
                success: false,
                code: 'INVALID_CREDENTIALS',
                message: `Incorrect ID/phone number or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
            });
        }

        // Live client status check — same reasoning as verify-otp.js/refresh.js:
        // a client whose underlying record moved out of 'active' after they
        // set a password shouldn't keep access just because client_accounts
        // is still marked active.
        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: account.client_id } } })
        ).then(r => r.data?.clients ?? []);

        if (client?.status !== 'active') {
            return res.status(403).json({ success: false, code: 'ACCOUNT_UNAVAILABLE', message: 'This account is not active. Contact your branch.' });
        }

        await graph.mutation(
            updateQl(CLIENT_ACCOUNT_TYPE, {
                set: { failed_password_attempts: 0 },
                where: { _id: { _eq: account._id } }
            })
        );

        const refreshToken = await issueRefreshToken(account._id);
        const token = jwt.sign(
            { typ: 'client', clientAccountId: account._id, clientId: account.client_id },
            serverRuntimeConfig.clientSecret,
            { expiresIn: '30m' }
        );

        return res.status(200).json({
            success: true,
            token,
            refreshToken,
            clientId: account.client_id,
            // Forces the app to route through a mandatory password-change
            // screen before granting normal access — set on every
            // staff-generated password (activation or reset), since staff
            // and possibly others present know that password.
            mustChangePassword: account.password_is_temporary === true,
        });

    } catch (error) {
        console.error('login-password error:', error);
        return res.status(500).json({ success: false, message: 'Login failed' });
    }
}