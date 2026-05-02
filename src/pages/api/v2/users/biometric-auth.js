// Public endpoint — no auth required
// GET: generate auth challenge (called before login)
// POST: verify biometric + issue session JWT (called before login)

import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import getConfig from 'next/config';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import logger from '@/logger';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `
    _id firstName lastName email role root
    designatedBranch designatedBranchId transactionType
    areaId regionId divisionId profile loNo status
    biometricCredentialId biometricPublicKey biometricCounter
    biometricRegisteredAt biometricDeviceName
    loginAttempts lockedUntil
`)('users');

export default async function handler(req, res) {
    if (req.method === 'GET') return generateChallenge(req, res);
    if (req.method === 'POST') return verifyAuth(req, res);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
}

// GET — generate authentication challenge
async function generateChallenge(req, res) {
    const { userId } = req.query;
    if (!userId) return res.status(200).json({ success: false, message: 'userId required' });

    try {
        const [user] = await graph.query(
            queryQl(USER_TYPE, { where: { _id: { _eq: userId } } })
        ).then(r => r.data?.users ?? []);

        if (!user?.biometricCredentialId) {
            return res.status(200).json({ success: false, message: 'No biometric registered.' });
        }

        const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';

        const options = await generateAuthenticationOptions({
            rpID,
            userVerification:  'preferred',
            allowCredentials: [{
                id:         user.biometricCredentialId, // already base64url — pass as-is
                type:       'public-key',
                transports: ['internal'],
            }],
        });

        // Sign challenge into JWT — stateless, works across all containers
        const challengeToken = jwt.sign(
            { userId, challenge: options.challenge },
            serverRuntimeConfig.secret,
            { expiresIn: '10m' }
        );

        return res.status(200).json({ success: true, options, challengeToken });
    } catch (err) {
        logger.error({ page: 'biometric-auth', message: 'Challenge error', error: err.message });
        return res.status(200).json({ success: false, message: 'Failed to generate challenge.' });
    }
}

// POST — verify biometric response + return session JWT
async function verifyAuth(req, res) {
    const { userId, credential, challengeToken } = req.body;
    if (!userId || !credential || !challengeToken) {
        return res.status(200).json({ success: false, message: 'userId, credential and challengeToken required' });
    }

    // Extract challenge from JWT — no server state needed
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

    try {
        const [user] = await graph.query(
            queryQl(USER_TYPE, { where: { _id: { _eq: userId } } })
        ).then(r => r.data?.users ?? []);

        if (!user?.biometricCredentialId || !user?.biometricPublicKey) {
            return res.status(200).json({ success: false, message: 'No biometric registered.' });
        }

        // Check lockout
        if (user.lockedUntil && moment().isBefore(moment(user.lockedUntil))) {
            const mins = moment(user.lockedUntil).diff(moment(), 'minutes') + 1;
            return res.status(200).json({
                success: false,
                locked:  true,
                message: `Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`,
            });
        }

        const rpID     = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
        const rpOrigin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';

        // credentialId stored as base64url string — decode to Uint8Array for verify
        // publicKey stored as base64 — decode to Uint8Array
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
                id:        base64urlToBuffer(user.biometricCredentialId),
                publicKey: Buffer.from(user.biometricPublicKey, 'base64'),
                counter:   user.biometricCounter || 0,
            },
            requireUserVerification: false,
        });

        if (!verification.verified) {
            return res.status(200).json({ success: false, message: 'Biometric authentication failed.' });
        }

        // Update counter + reset lockout
        await graph.mutation(
            updateQl(USER_TYPE, {
                where: { _id: { _eq: userId } },
                set: {
                    biometricCounter: verification.authenticationInfo.newCounter,
                    logged:           true,
                    lastLogin:        moment().format('YYYY-MM-DD'),
                    loginAttempts:    0,
                    lockedUntil:      null,
                },
            })
        );

        // Issue session JWT — same as password login
        const token = jwt.sign(
            { sub: user._id },
            serverRuntimeConfig.secret,
            { expiresIn: '4h' }
        );

        // Strip private key data — keep credentialId so client knows biometric is registered
        const { biometricPublicKey, biometricCounter, ...safeUser } = user;

        logger.info({ page: 'biometric-auth', message: 'Biometric login successful', userId });

        return res.status(200).json({
            success: true,
            user: { ...safeUser, __api_version: 'v2', token },
        });
    } catch (err) {
        logger.error({ page: 'biometric-auth', message: 'Auth error', error: err.message });
        return res.status(200).json({ success: false, message: err.message || 'Authentication failed.' });
    }
}