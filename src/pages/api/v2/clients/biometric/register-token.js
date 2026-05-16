// src/pages/api/v2/clients/biometric/register-token.js
// POST { clientId, loanId }
// Generates a single-use 8-hour JWT for public biometric registration.
// Called by DisbursementPhotoModal when client has no biometricCredentialId.
// Token stored in biometricRegistrationTokens table to enforce single-use.

import { apiHandler }                from '@/services/api-handler';
import { GraphProvider }             from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { findUserById }              from '@/lib/graph.functions';
import { generateUUID }              from '@/lib/utils';
import { logAudit }                  from '@/lib/audit';
import getConfig                     from 'next/config';
import jwt                           from 'jsonwebtoken';
import moment                        from 'moment';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName biometricCredentialId
`)('clients');

const TOKEN_TYPE = createGraphType('biometricRegistrationTokens', `
    _id clientId loanId token usedAt expiresAt createdAt createdBy
`)('biometricRegistrationTokens');

export default apiHandler({ post: generateToken });

async function generateToken(req, res) {
    const { clientId, loanId } = req.body;
    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId required.' });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    // Verify client exists and has no biometric yet
    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    if (client.biometricCredentialId) {
        return res.status(200).json({
            success: false,
            message: 'Client already has biometric registered. Use verify flow instead.',
        });
    }

    // Generate single-use JWT — 8 hour expiry
    const tokenId  = generateUUID();
    const expiresAt = moment().add(8, 'hours').toISOString();

    const token = jwt.sign(
        {
            type:      'biometric_registration',
            clientId,
            loanId:    loanId || null,
            tokenId,   // stored in DB — checked on use to enforce single-use
        },
        serverRuntimeConfig.secret,
        { expiresIn: '8h' }
    );

    // Store token record for single-use enforcement
    await graph.mutation(
        insertQl(TOKEN_TYPE, {
            objects: [{
                _id:       tokenId,
                clientId,
                loanId:    loanId || null,
                token,
                usedAt:    null,
                expiresAt,
                createdAt: moment().toISOString(),
                createdBy: currentUser._id,
            }],
        })
    );

    await logAudit(req, {
        action:      'BIOMETRIC_REGISTER_TOKEN_GENERATED',
        category:    'BIOMETRIC',
        severity:    'INFO',
        entityType:  'client',
        entityId:    clientId,
        description: `Biometric registration token generated for ${client.firstName} ${client.lastName} by ${currentUser.firstName} ${currentUser.lastName}`,
        branchId:    currentUser.designatedBranchId,
        metadata:    { tokenId, loanId, expiresAt },
    });

    return res.status(200).json({
        success: true,
        token,
        tokenId,
        expiresAt,
        clientName: `${client.firstName} ${client.lastName}`,
    });
}