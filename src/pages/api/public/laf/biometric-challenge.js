// src/pages/api/public/laf/biometric-challenge.js
// GET ?sessionId=xxx
// Generates WebAuthn registration challenge for the LAF public form.
// No auth required — LAF is filled on the client's own device.
// Protected by x-laf-api-key header via publicApiHandler.

import { generateRegistrationOptions } from '@simplewebauthn/server';
import { publicApiHandler }            from '@/services/public-api-handler';
import getConfig                       from 'next/config';
import jwt                             from 'jsonwebtoken';

const { serverRuntimeConfig } = getConfig();

export default publicApiHandler({ get: biometricChallenge });

async function biometricChallenge(req, res) {
    const { sessionId } = req.query;
    if (!sessionId) {
        return res.status(200).json({ success: false, message: 'sessionId required' });
    }

    const rpID         = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
    const userIDBuffer = new TextEncoder().encode(sessionId);

    const options = await generateRegistrationOptions({
        rpName:                 'AmberCash LMS',
        rpID,
        userID:                 userIDBuffer,
        userName:               `laf-client-${sessionId}`,
        userDisplayName:        'Loan Applicant',
        attestationType:        'none',
        authenticatorSelection: {
            residentKey:             'preferred',
            userVerification:        'preferred',
            authenticatorAttachment: 'platform',
        },
        excludeCredentials: [],
    });

    // Embed challenge in JWT — stateless, works across all Docker containers
    const challengeToken = jwt.sign(
        { sessionId, challenge: options.challenge },
        serverRuntimeConfig.secret,
        { expiresIn: '10m' }
    );

    return res.status(200).json({ success: true, options, challengeToken });
}