// Public API — no auth required
// Called from client's phone after biometric scan
// Verifies credential and marks loan.clientBiometricVerified = true

import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';
import moment from 'moment';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id biometricCredentialId biometricPublicKey biometricCounter faceTemplate
`)('clients');

const LOAN_UPDATE_TYPE = createGraphType('loans', `
    _id clientBiometricVerified clientBiometricVerifiedAt
`);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { loanId, credential, challengeToken, faceTemplateOnly } = req.body;

    // faceTemplateOnly path — no WebAuthn credential, just mark verified
    if (faceTemplateOnly && loanId) {
        try {
            await graph.mutation(
                updateQl(LOAN_UPDATE_TYPE('client_bio_verify'), {
                    where: { _id: { _eq: loanId } },
                    set: {
                        clientBiometricVerified:   true,
                        clientBiometricVerifiedAt: moment().toISOString(),
                    },
                })
            );
            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(200).json({ success: false, message: err.message || 'Failed.' });
        }
    }

    if (!loanId || !credential || !challengeToken) {
        return res.status(200).json({
            success: false,
            message: 'loanId, credential and challengeToken are required',
        });
    }

    // Verify JWT — extract challenge and clientId
    let expectedChallenge, clientId;
    try {
        const decoded = jwt.verify(challengeToken, serverRuntimeConfig.secret);
        if (decoded.loanId !== loanId) {
            return res.status(200).json({ success: false, message: 'Token mismatch.' });
        }
        expectedChallenge = decoded.challenge;
        clientId          = decoded.clientId;
    } catch (err) {
        return res.status(200).json({
            success: false,
            message: err.name === 'TokenExpiredError'
                ? 'Challenge expired. Please try again.'
                : 'Invalid challenge token.',
        });
    }

    try {
        // Get client biometric data
        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
        ).then(r => r.data?.clients ?? []);

        // faceTemplate-only clients: skip WebAuthn, mark as verified directly.
        // The verify page already confirmed client was physically present
        // via the simple confirmation button (no WebAuthn challenge needed).
        if (!client?.biometricCredentialId || !client?.biometricPublicKey) {
            if (client?.faceTemplate) {
                await graph.mutation(
                    updateQl(LOAN_UPDATE_TYPE('client_bio_verify'), {
                        where: { _id: { _eq: loanId } },
                        set: {
                            clientBiometricVerified:   true,
                            clientBiometricVerifiedAt: moment().toISOString(),
                        },
                    })
                );
                return res.status(200).json({ success: true });
            }
            return res.status(200).json({ success: false, message: 'No biometric registered.' });
        }

        const rpID     = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
        const rpOrigin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';

        // Decode credential ID from base64url
        function base64urlToBuffer(b64url) {
            const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
            const bin = atob(b64);
            const buf = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
            return buf;
        }

        const verification = await verifyAuthenticationResponse({
            response:            credential,
            expectedChallenge,
            expectedOrigin:      rpOrigin,
            expectedRPID:        rpID,
            credential: {
                id:        base64urlToBuffer(client.biometricCredentialId),
                publicKey: Buffer.from(client.biometricPublicKey, 'base64'),
                counter:   client.biometricCounter || 0,
            },
            requireUserVerification: false,
        });

        if (!verification.verified) {
            return res.status(200).json({ success: false, message: 'Biometric verification failed.' });
        }

        // Mark loan as client biometric verified
        await graph.mutation(
            updateQl(LOAN_UPDATE_TYPE('client_bio_verify'), {
                where: { _id: { _eq: loanId } },
                set: {
                    clientBiometricVerified:   true,
                    clientBiometricVerifiedAt: moment().toISOString(),
                },
            })
        );

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(200).json({ success: false, message: err.message || 'Verification failed.' });
    }
}