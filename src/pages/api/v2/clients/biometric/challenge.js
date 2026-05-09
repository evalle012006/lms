// src/pages/api/v2/clients/biometric/challenge.js
// GET ?clientId=xxx
// Generates WebAuthn registration challenge for an existing client

import { generateRegistrationOptions } from '@simplewebauthn/server';
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName biometricCredentialId
`)('clients');

export default apiHandler({ get: challenge });

async function challenge(req, res) {
    const { clientId } = req.query;
    if (!clientId) return res.status(200).json({ success: false, message: 'clientId required' });

    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) return res.status(200).json({ success: false, message: 'Client not found.' });

    const rpID   = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
    const origin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';

    const options = await generateRegistrationOptions({
        rpName:                'AmberCash LMS',
        rpID,
        userID:                client._id,
        userName:              `${client.firstName} ${client.lastName}`,
        userDisplayName:       `${client.firstName} ${client.lastName}`,
        attestationType:       'none',
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

    const challengeToken = jwt.sign(
        { clientId, challenge: options.challenge },
        serverRuntimeConfig.secret,
        { expiresIn: '10m' }
    );

    return res.status(200).json({ success: true, options, challengeToken });
}