import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import logger from '@/logger';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const UPDATE_TYPE = createGraphType('users', `
    _id biometricCredentialId biometricPublicKey
    biometricCounter biometricRegisteredAt biometricDeviceName
`);

export default apiHandler({ post: verifyRegistration });

async function verifyRegistration(req, res) {
    const { userId, credential, deviceName, challengeToken } = req.body;

    if (!userId || !credential || !challengeToken) {
        return res.status(200).json({
            success: false,
            message: 'userId, credential and challengeToken are required',
        });
    }

    // Verify and extract challenge from JWT — no shared Map needed
    let expectedChallenge;
    try {
        const decoded = jwt.verify(challengeToken, serverRuntimeConfig.secret);
        if (decoded.userId !== userId) {
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
        // Store credentialId as base64url string (what browser uses natively)
        // credential.id from the browser registration response is already base64url
        const credIdB64url = credential.id; // original base64url from browser
        const pubKeyB64    = Buffer.from(cred.publicKey).toString('base64');

        await graph.mutation(
            updateQl(UPDATE_TYPE('bio_reg'), {
                where: { _id: { _eq: userId } },
                set: {
                    biometricCredentialId: credIdB64url,
                    biometricPublicKey:    pubKeyB64,
                    biometricCounter:      cred.counter,
                    biometricRegisteredAt: moment().toISOString(),
                    biometricDeviceName:   deviceName || 'Unknown Device',
                },
            })
        );

        logger.info({ page: 'webauthn', message: 'Biometric registered', userId });
        return res.status(200).json({ success: true, message: 'Biometric registered successfully.' });
    } catch (err) {
        logger.error({ page: 'webauthn', message: 'Registration error', error: err.message });
        return res.status(200).json({ success: false, message: err.message || 'Registration failed.' });
    }
}