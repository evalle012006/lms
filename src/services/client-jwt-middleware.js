// Client-facing auth. Deliberately separate from services/jwt-middleware.js:
// - different secret (CLIENT_JWT_SECRET, not the staff `secret`), so the two
//   token populations can be rotated/revoked independently
// - a `typ: 'client'` claim checked explicitly, so a staff token can never be
//   replayed against a mobile route (and vice versa) even if secrets were
//   ever accidentally shared
//
// Every mobile route handler MUST read the client id from req.auth.clientId
// (set here after verification) — never from req.query/req.body. See
// get-payment-history.js in the staff API for the pattern this is guarding against:
// it trusts a caller-supplied loanId with no ownership check. That is fine for
// a staff-only UI; it is a full cross-client data leak on a public app.

import getConfig from 'next/config';

const jwt = require('jsonwebtoken');

const { serverRuntimeConfig } = getConfig();

export { clientJwtMiddleware };

async function clientJwtMiddleware(req, res) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;

    if (!token) {
        res.status(401).json({ success: false, message: 'Missing bearer token' });
        return false;
    }

    try {
        const payload = jwt.verify(token, serverRuntimeConfig.clientSecret, { algorithms: ['HS256'] });

        if (payload.typ !== 'client' || !payload.clientAccountId || !payload.clientId) {
            res.status(401).json({ success: false, message: 'Invalid token' });
            return false;
        }

        req.auth = {
            clientAccountId: payload.clientAccountId,
            clientId:        payload.clientId,
        };
        return true;
    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return false;
    }
}