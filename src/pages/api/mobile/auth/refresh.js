import getConfig from 'next/config';
import moment from 'moment';

const jwt = require('jsonwebtoken');

import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { hashToken, issueRefreshToken } from '@/services/refresh-token-service';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const REFRESH_TOKEN_TYPE = createGraphType('client_refresh_tokens', `
  _id client_account_id expires_at revoked_at replaced_by_id
`)('client_refresh_tokens');

const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id client_id status
`)('client_accounts');

// Same live check as verify-otp.js's login branch — see the comment there.
const CLIENT_STATUS_TYPE = createGraphType('client', `_id status`)('clients');

async function isClientActive(clientId) {
    const [client] = await graph.query(
        queryQl(CLIENT_STATUS_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);
    return client?.status === 'active';
}

export default clientApiHandler({
    post: refresh
});

async function refresh(req, res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'refreshToken is required' });
        }

        const tokenHash = hashToken(refreshToken);

        const [stored] = await graph.query(
            queryQl(REFRESH_TOKEN_TYPE, { where: { token_hash: { _eq: tokenHash } } })
        ).then(r => r.data?.client_refresh_tokens ?? []);

        if (!stored) {
            return res.status(401).json({ success: false, code: 'INVALID_REFRESH_TOKEN', message: 'Please sign in again.' });
        }

        if (stored.revoked_at) {
            // This exact token was already rotated out once before. Seeing it
            // again means either a client retried a stale copy (harmless) or
            // the token leaked and is being replayed (not harmless) — we can't
            // tell which from here, so the safe default is to require a fresh
            // login rather than silently issue another token off a revoked one.
            return res.status(401).json({ success: false, code: 'TOKEN_REUSED', message: 'Session no longer valid. Please sign in again.' });
        }

        if (moment().isAfter(moment(stored.expires_at))) {
            return res.status(401).json({ success: false, code: 'EXPIRED', message: 'Session expired. Please sign in again.' });
        }

        const [account] = await graph.query(
            queryQl(CLIENT_ACCOUNT_TYPE, { where: { _id: { _eq: stored.client_account_id }, status: { _eq: 'active' } } })
        ).then(r => r.data?.client_accounts ?? []);

        if (!account) {
            return res.status(403).json({ success: false, code: 'ACCOUNT_UNAVAILABLE', message: 'This account is not active. Contact your branch.' });
        }

        if (!(await isClientActive(account.client_id))) {
            return res.status(403).json({ success: false, code: 'ACCOUNT_UNAVAILABLE', message: 'This account is not active. Contact your branch.' });
        }

        // Rotate: issue a new refresh token, revoke this one. A refresh token
        // is single-use — if the app failed to persist the new one (crash,
        // killed mid-write) the user just has to log in again, which is a far
        // smaller cost than letting refresh tokens be reused indefinitely.
        const newRefreshToken = await issueRefreshToken(account._id, { replacesTokenId: stored._id });

        const newAccessToken = jwt.sign(
            { typ: 'client', clientAccountId: account._id, clientId: account.client_id },
            serverRuntimeConfig.clientSecret,
            { expiresIn: '30m' }
        );

        return res.status(200).json({ success: true, token: newAccessToken, refreshToken: newRefreshToken });

    } catch (error) {
        console.error('refresh error:', error);
        return res.status(500).json({ success: false, message: 'Failed to refresh session' });
    }
}