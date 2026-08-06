// src/pages/api/public/biometric/register-challenge.js
// GET ?token=xxx
// Returns WebAuthn registration options for the client identified by the token.
// Public — no auth — token carries the clientId.

import { generateRegistrationOptions } from '@simplewebauthn/server';
import { GraphProvider }               from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }    from '@/lib/graph/graph.util';
import getConfig                       from 'next/config';
import { publicApiHandler } from '@/services/public-api-handler';
import jwt    from 'jsonwebtoken';
import crypto from 'crypto';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const TOKEN_TYPE = createGraphType('biometricRegistrationTokens', `
    _id clientId loanId usedAt expiresAt
`)('biometricRegistrationTokens');

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName biometricCredentialId
`)('clients');

async function getChallenge(req, res) {

    const { token } = req.query;
    if (!token) return res.status(200).json({ success: false, message: 'Token required.' });

    try {
        // Verify JWT
        const decoded = jwt.verify(token, serverRuntimeConfig.secret);
        if (decoded.type !== 'biometric_registration') {
            return res.status(200).json({ success: false, message: 'Invalid token.' });
        }

        // Check DB record — enforce single-use
        const [record] = await graph.query(
            queryQl(TOKEN_TYPE, { where: { _id: { _eq: decoded.tokenId } } })
        ).then(r => r.data?.biometricRegistrationTokens ?? []);

        if (!record)        return res.status(200).json({ success: false, message: 'Token not found.' });
        if (record.usedAt)  return res.status(200).json({ success: false, message: 'This link has already been used.' });

        // Fetch client
        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: record.clientId } } })
        ).then(r => r.data?.clients ?? []);

        if (!client) return res.status(200).json({ success: false, message: 'Client not found.' });

        const rpID   = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID    || 'localhost';
        const origin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN   || 'http://localhost:3000';

        const options = await generateRegistrationOptions({
            rpName:    'AmberCash LMS',
            rpID,
            userID:    client._id,
            userName:  `${client.firstName} ${client.lastName}`,
            userDisplayName: `${client.firstName} ${client.lastName}`,
            attestationType: 'none',
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification:        'preferred',
                residentKey:             'preferred',
            },
            excludeCredentials: client.biometricCredentialId ? [{
                id:         client.biometricCredentialId,
                type:       'public-key',
                transports: ['internal'],
            }] : [],
        });

        // Store challenge in a short-lived JWT (10 min)
        const challengeToken = jwt.sign(
            { clientId: record.clientId, tokenId: decoded.tokenId, challenge: options.challenge },
            serverRuntimeConfig.secret,
            { expiresIn: '10m' }
        );

        // Embed challenge directly in challengeToken JWT (10 min expiry)
        // register-complete.js will extract it from there — no Redis needed
        return res.status(200).json({ success: true, options, challengeToken });
    } catch (err) {
        const isExpired = err.name === 'TokenExpiredError';
        return res.status(200).json({
            success: false,
            message: isExpired ? 'This link has expired.' : (err.message || 'Server error.'),
        });
    }
}

export default publicApiHandler({ get: getChallenge });