// src/pages/api/v2/clients/biometric/register.js
// POST { clientId, credential, challengeToken, deviceName }
// Saves biometric credential to client record — called by staff on client's device

import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { CLIENT_FIELDS } from '@/lib/graph.fields';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';
import moment from 'moment';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');

export default apiHandler({ post: register });

async function register(req, res) {
    const { clientId, credential, challengeToken, deviceName } = req.body;

    if (!clientId || !credential || !challengeToken) {
        return res.status(200).json({ success: false, message: 'Missing required fields.' });
    }

    // Verify JWT challenge
    let expectedChallenge;
    try {
        const decoded = jwt.verify(challengeToken, serverRuntimeConfig.secret);
        if (decoded.clientId !== clientId) {
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

        // Save to client record — clear any pending update request
        await graph.mutation(
            updateQl(CLIENT_TYPE, {
                where: { _id: { _eq: clientId } },
                set: {
                    biometricCredentialId:      Buffer.from(cred.id).toString('base64url'),
                    biometricPublicKey:          Buffer.from(cred.publicKey).toString('base64'),
                    biometricCounter:            cred.counter,
                    biometricRegisteredAt:        moment().toISOString(),
                    biometricDeviceName:          deviceName || 'Device',
                    // Clear update request fields
                    biometricUpdateRequestedAt:  null,
                    biometricUpdateRequestedBy:  null,
                    biometricUpdateApprovedAt:   null,
                    biometricUpdateApprovedBy:   null,
                },
            })
        );

        return res.status(200).json({ success: true, message: 'Biometric registered successfully.' });
    } catch (err) {
        return res.status(200).json({ success: false, message: err.message || 'Registration failed.' });
    }
}