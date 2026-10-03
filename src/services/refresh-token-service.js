import crypto from 'crypto';
import moment from 'moment';

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();

const REFRESH_TOKEN_TYPE = createGraphType('client_refresh_tokens', `
  _id client_account_id token_hash expires_at revoked_at replaced_by_id
`)('client_refresh_tokens');

const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(token) {
    // SHA-256, not bcrypt — see the schema comment on why.
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Generates a new refresh token, stores its hash, returns the raw token
// (the only time the raw value exists — never store it, only the hash).
export async function issueRefreshToken(clientAccountId, { replacesTokenId = null } = {}) {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = moment().add(REFRESH_TOKEN_TTL_DAYS, 'days').toISOString();
    const newId = generateUUID();

    await graph.mutation(
        insertQl(REFRESH_TOKEN_TYPE, {
            objects: [{ _id: newId, client_account_id: clientAccountId, token_hash: tokenHash, expires_at: expiresAt }]
        })
    );

    if (replacesTokenId) {
        await graph.mutation(
            updateQl(REFRESH_TOKEN_TYPE, {
                set: { replaced_by_id: newId, revoked_at: moment().toISOString() },
                where: { _id: { _eq: replacesTokenId } }
            })
        );
    }

    return rawToken;
}

export { hashToken, REFRESH_TOKEN_TYPE, graph as refreshTokenGraph };