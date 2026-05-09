// src/pages/api/v2/clients/biometric/request-update.js
// POST { clientId }              → BM/LO submits update request
// POST { clientId, approve: true } → rep<=2 approves the request

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { CLIENT_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');

export default apiHandler({ post: handleRequest });

async function handleRequest(req, res) {
    const { clientId, approve } = req.body;
    if (!clientId) return res.status(200).json({ success: false, message: 'clientId required.' });

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) return res.status(200).json({ success: false, message: 'Client not found.' });

    if (approve) {
        // ── Approve request — only rep <= 2 (admin or area+) ─────────────
        if (currentUser.role.rep > 2) {
            return res.status(200).json({
                success: false,
                message: 'Only Area Admin or Administrator can approve biometric updates.',
            });
        }

        if (!client.biometricUpdateRequestedAt) {
            return res.status(200).json({
                success: false,
                message: 'No pending update request for this client.',
            });
        }

        await graph.mutation(
            updateQl(CLIENT_TYPE, {
                where: { _id: { _eq: clientId } },
                set: {
                    biometricUpdateApprovedAt: moment().toISOString(),
                    biometricUpdateApprovedBy: `${currentUser.firstName} ${currentUser.lastName}`,
                },
            })
        );

        return res.status(200).json({
            success: true,
            message: 'Biometric update approved. The client can now register a new biometric.',
        });
    }

    // ── Submit request ─────────────────────────────────────────────────────
    if (!client.biometricCredentialId) {
        return res.status(200).json({
            success: false,
            message: 'Client has no biometric registered. Register directly instead.',
        });
    }

    if (client.biometricUpdateRequestedAt && !client.biometricUpdateApprovedAt) {
        return res.status(200).json({
            success: false,
            message: 'A biometric update request is already pending approval.',
        });
    }

    await graph.mutation(
        updateQl(CLIENT_TYPE, {
            where: { _id: { _eq: clientId } },
            set: {
                biometricUpdateRequestedAt: moment().toISOString(),
                biometricUpdateRequestedBy: `${currentUser.firstName} ${currentUser.lastName}`,
                biometricUpdateApprovedAt:  null,
                biometricUpdateApprovedBy:  null,
            },
        })
    );

    return res.status(200).json({
        success: true,
        message: 'Biometric update request submitted. Awaiting approval from Area Admin or above.',
    });
}