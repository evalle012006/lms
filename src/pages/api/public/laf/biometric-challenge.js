// Public API — no auth required (LAF is a public form)
// Uses same JWT stateless pattern as user biometric

import { generateRegistrationOptions } from '@simplewebauthn/server';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const { serverRuntimeConfig } = getConfig();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

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
            authenticatorAttachment: 'platform', // phone fingerprint/Face ID
        },
        excludeCredentials: [],
    });

    const challengeToken = jwt.sign(
        { sessionId, challenge: options.challenge },
        serverRuntimeConfig.secret,
        { expiresIn: '10m' }
    );

    return res.status(200).json({ success: true, options, challengeToken });
}