// src/pages/api/v2/clients/biometric/status.js
// GET ?clientId=xxx
// Returns whether a client has biometric registered.
// Called by DisbursementPhotoModal to determine register vs verify mode,
// and polled every 3s to detect when registration completes.
//
// Migration note: system uses two separate biometric systems:
//   faceTemplate     — face embedding from LAF face capture (cannot do WebAuthn verify)
//   biometricCredentialId — WebAuthn credential (can do challenge/verify flow)
// hasWebAuthn tells the modal which QR flow to show.

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id biometricCredentialId biometricRegisteredAt biometricDeviceName
    faceTemplate faceEnrolledAt
`)('clients');

export default apiHandler({ get: checkStatus });

async function checkStatus(req, res) {
    const { clientId } = req.query;
    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId required.' });
    }

    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    return res.status(200).json({
        success:      true,
        hasBiometric: !!(client.faceTemplate || client.biometricCredentialId),
        registeredAt: client.faceEnrolledAt || client.biometricRegisteredAt || null,
        deviceName:   client.biometricDeviceName || null,
    });
}