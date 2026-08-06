import { generateRegistrationOptions } from '@simplewebauthn/server';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';
import logger from '@/logger';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `
    _id firstName lastName email biometricCredentialId
`)('users');

export default apiHandler({ get: generateChallenge });

async function generateChallenge(req, res) {
    const { userId } = req.query;
    if (!userId) {
        return res.status(200).json({ success: false, message: 'userId required' });
    }

    const [user] = await graph.query(
        queryQl(USER_TYPE, { where: { _id: { _eq: userId } } })
    ).then(r => r.data?.users ?? []);

    if (!user) {
        return res.status(200).json({ success: false, message: 'User not found' });
    }

    const rpID         = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
    const userIDBuffer = new TextEncoder().encode(userId);

    const options = await generateRegistrationOptions({
        rpName:                 'AmberCash LMS',
        rpID,
        userID:                 userIDBuffer,
        userName:               user.email,
        userDisplayName:        `${user.firstName} ${user.lastName}`,
        attestationType:        'none',
        authenticatorSelection: {
            residentKey:             'preferred',
            userVerification:        'preferred',
            authenticatorAttachment: 'platform',
        },
        excludeCredentials: user.biometricCredentialId
            ? [{ id: user.biometricCredentialId, type: 'public-key' }]
            : [],
    });

    // Sign challenge into a JWT — no server-side state needed
    // Any container can verify it using the shared secret
    const challengeToken = jwt.sign(
        { userId, challenge: options.challenge },
        serverRuntimeConfig.secret,
        { expiresIn: '10m' }
    );

    logger.debug({ page: 'webauthn', message: 'Registration challenge generated', userId });

    return res.status(200).json({ success: true, options, challengeToken });
}