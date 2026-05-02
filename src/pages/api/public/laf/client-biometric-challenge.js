// Public API — no auth required
// Called from client's phone at /biometric-verify/[loanId]
// Fetches client biometric credential and generates auth challenge

import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const LOAN_TYPE = createGraphType('loans', `
    _id fullName pnNumber clientId
    clientBiometricVerified clientBiometricVerifiedAt
`)('loans');

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName
    biometricCredentialId biometricPublicKey biometricCounter
`)('clients');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { loanId } = req.query;
    if (!loanId) {
        return res.status(200).json({ success: false, message: 'loanId required' });
    }

    try {
        // Get loan to find clientId
        const [loan] = await graph.query(
            queryQl(LOAN_TYPE, { where: { _id: { _eq: loanId } } })
        ).then(r => r.data?.loans ?? []);

        if (!loan) {
            return res.status(200).json({ success: false, message: 'Loan not found.' });
        }

        // Already verified
        if (loan.clientBiometricVerified) {
            return res.status(200).json({
                success:         false,
                alreadyVerified: true,
                message:         'Identity already verified for this loan.',
            });
        }

        // Get client biometric credential
        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: loan.clientId } } })
        ).then(r => r.data?.clients ?? []);

        if (!client?.biometricCredentialId) {
            return res.status(200).json({
                success:     false,
                noBiometric: true,
                message:     'No biometric registered for this client. Please inform the branch officer.',
            });
        }

        const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';

        const options = await generateAuthenticationOptions({
            rpID,
            userVerification:  'preferred',
            allowCredentials: [{
                id:         client.biometricCredentialId,
                type:       'public-key',
                transports: ['internal'],
            }],
        });

        // JWT stateless challenge
        const challengeToken = jwt.sign(
            { loanId, clientId: loan.clientId, challenge: options.challenge },
            serverRuntimeConfig.secret,
            { expiresIn: '10m' }
        );

        return res.status(200).json({
            success:       true,
            options,
            challengeToken,
            loanInfo: {
                clientName: loan.fullName,
                pnNumber:   loan.pnNumber,
            },
        });
    } catch (err) {
        return res.status(200).json({ success: false, message: err.message || 'Server error.' });
    }
}