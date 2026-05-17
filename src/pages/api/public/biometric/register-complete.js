// src/pages/api/public/biometric/register-complete.js
// POST { token, credential, deviceName }
// Verifies WebAuthn attestation and saves biometric to client record.
// Marks the registration token as used (single-use enforcement).
// Public — no auth — token carries clientId + single-use tokenId.

import { verifyRegistrationResponse }  from '@simplewebauthn/server';
import { GraphProvider }               from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { CLIENT_FIELDS }               from '@/lib/graph.fields';
import { logAuditPublic }              from '@/lib/audit';
import getConfig                       from 'next/config';
import { publicApiHandler } from '@/services/public-api-handler';
import jwt    from 'jsonwebtoken';
import moment from 'moment';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const TOKEN_TYPE = createGraphType('biometricRegistrationTokens', `
    _id clientId loanId usedAt expiresAt
`)('biometricRegistrationTokens');

const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');

async function registerComplete(req, res) {

    const { token, credential, deviceName } = req.body;
    if (!token || !credential) {
        return res.status(200).json({ success: false, message: 'Missing required fields.' });
    }

    try {
        // Verify outer JWT (8hr token from QR)
        const decoded = jwt.verify(token, serverRuntimeConfig.secret);
        if (decoded.type !== 'biometric_registration') {
            return res.status(200).json({ success: false, message: 'Invalid token.' });
        }

        // Double-check token record (race condition guard)
        const [record] = await graph.query(
            queryQl(TOKEN_TYPE, { where: { _id: { _eq: decoded.tokenId } } })
        ).then(r => r.data?.biometricRegistrationTokens ?? []);

        if (!record)       return res.status(200).json({ success: false, message: 'Token not found.' });
        if (record.usedAt) return res.status(200).json({ success: false, message: 'This link has already been used.' });

        const rpID     = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID  || 'localhost';
        const rpOrigin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';

        // We need the challenge — it was embedded in the credential's clientDataJSON
        // The challenge was generated in register-challenge.js and the client sends it back
        // via the credential. We verify using the credential directly.
        // The expected challenge is stored in the clientDataJSON — WebAuthn library handles this.
        // Extract challenge from challengeToken JWT (sent by client during registration)
        // The challenge was embedded in challengeToken by register-challenge.js
        const { challengeToken } = req.body;
        if (!challengeToken) {
            return res.status(200).json({ success: false, message: 'Challenge token missing.' });
        }
        let expectedChallenge;
        try {
            const challengeDecoded = jwt.verify(challengeToken, serverRuntimeConfig.secret);
            expectedChallenge = challengeDecoded.challenge;
            // Verify the tokenId matches — prevents cross-token attacks
            if (challengeDecoded.tokenId !== decoded.tokenId) {
                return res.status(200).json({ success: false, message: 'Token mismatch.' });
            }
        } catch (e) {
            return res.status(200).json({
                success: false,
                message: e.name === 'TokenExpiredError'
                    ? 'Challenge expired. Please ask the Branch Manager to generate a new QR code.'
                    : 'Invalid challenge token.',
            });
        }

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

        // Mark token as used FIRST (prevent race condition re-use)
        await graph.mutation(
            updateQl(TOKEN_TYPE, {
                where: { _id: { _eq: decoded.tokenId } },
                set: { usedAt: moment().toISOString() },
            })
        );

        // Save biometric to client record
        await graph.mutation(
            updateQl(CLIENT_TYPE, {
                where: { _id: { _eq: record.clientId } },
                set: {
                    biometricCredentialId: Buffer.from(cred.id).toString('base64url'),
                    biometricPublicKey:    Buffer.from(cred.publicKey).toString('base64'),
                    biometricCounter:      cred.counter,
                    biometricRegisteredAt: moment().toISOString(),
                    biometricDeviceName:   deviceName || 'Mobile Device',
                },
            })
        );

        await logAuditPublic(req, {
            action:      'BIOMETRIC_REGISTERED_AT_DISBURSEMENT',
            category:    'BIOMETRIC',
            severity:    'INFO',
            entityType:  'client',
            entityId:    record.clientId,
            description: `Client biometric registered at disbursement via QR token`,
            metadata:    { tokenId: decoded.tokenId, loanId: record.loanId, deviceName },
        });

        return res.status(200).json({ success: true, message: 'Biometric registered successfully.' });

    } catch (err) {
        const isExpired = err.name === 'TokenExpiredError';
        return res.status(200).json({
            success: false,
            message: isExpired ? 'Link expired.' : (err.message || 'Registration failed.'),
        });
    }
}

export default publicApiHandler({ post: registerComplete });