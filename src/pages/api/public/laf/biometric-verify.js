// Public API — no auth required
// Verifies the biometric credential and returns the credential data
// to be stored alongside the LAF submission

import { verifyRegistrationResponse } from '@simplewebauthn/server';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';

const { serverRuntimeConfig } = getConfig();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { sessionId, credential, challengeToken } = req.body;

    if (!sessionId || !credential || !challengeToken) {
        return res.status(200).json({
            success: false,
            message: 'sessionId, credential and challengeToken are required',
        });
    }

    // Verify JWT — stateless, works across all containers
    let expectedChallenge;
    try {
        const decoded = jwt.verify(challengeToken, serverRuntimeConfig.secret);
        if (decoded.sessionId !== sessionId) {
            return res.status(200).json({ success: false, message: 'Token mismatch.' });
        }
        expectedChallenge = decoded.challenge;
    } catch (err) {
        return res.status(200).json({
            success: false,
            message: err.name === 'TokenExpiredError'
                ? 'Challenge expired. Please try again.'
                : 'Invalid challenge token.',
        });
    }

    const rpID     = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
    const rpOrigin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';

    try {
        const verification = await verifyRegistrationResponse({
            response:                credential,
            expectedChallenge,
            expectedOrigin:          rpOrigin,
            expectedRPID:            rpID,
            requireUserVerification: false,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return res.status(200).json({ success: false, message: 'Biometric verification failed.' });
        }

        const { credential: cred } = verification.registrationInfo;
        const credIdB64 = Buffer.from(cred.id).toString('base64url');
        const pubKeyB64 = Buffer.from(cred.publicKey).toString('base64');

        // Return credential data to client — will be included in LAF submission payload
        return res.status(200).json({
            success:               true,
            biometricCredentialId: credIdB64,
            biometricPublicKey:    pubKeyB64,
            biometricCounter:      cred.counter,
            biometricDeviceName:   req.headers['user-agent']?.includes('iPhone') ? 'iPhone'
                : req.headers['user-agent']?.includes('Android') ? 'Android'
                : 'Mobile Device',
        });
    } catch (err) {
        return res.status(200).json({
            success: false,
            message: err.message || 'Biometric registration failed.',
        });
    }
}