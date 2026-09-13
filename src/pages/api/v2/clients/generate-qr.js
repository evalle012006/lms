// src/pages/api/v2/clients/generate-qr.js
// POST { clientId }
// Generates (or regenerates) a QR token for a client's field cash-collection
// flow. Only the client's assigned LO or a BM+/admin for that branch can
// generate. Active clients only — per the original spec, prospects/offset
// clients have no field-collection use case for this QR.
//
// No expiry stored — validity is checked LIVE at scan time (client/loan
// status), not via a stored qrExpiresAt like groups/generate-qr.js uses.
// Regenerating overwrites the old token, which silently invalidates any
// previously issued/printed QR for this client — same revocation model as
// the group QR, just without a time-based expiry on top of it.

import { apiHandler }                          from '@/services/api-handler';
import { GraphProvider }                       from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl }  from '@/lib/graph/graph.util';
import { CLIENT_FIELDS }                       from '@/lib/graph.fields';
import { findUserById }                        from '@/lib/graph.functions';
import { generateUUID }                        from '@/lib/utils';
import { logAudit }                            from '@/lib/audit';
import moment                                  from 'moment';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    branch { _id name code }
    lo { _id firstName lastName }
`)('clients');

export default apiHandler({ post: generateClientQR });

async function generateClientQR(req, res) {
    const { clientId } = req.body;
    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId required.' });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    // Per the confirmed design: LO (exact) or BM (branch match) only.
    // Deliberately narrower than groups/generate-qr.js's rep<=4 — that
    // endpoint allows admin/area+ too, but field cash-collection QR
    // generation has no legitimate admin/area use case and widening it
    // would just be unnecessary surface area on a token tied to money.
    if (![3, 4].includes(currentUser.role.rep)) {
        return res.status(200).json({
            success: false,
            message: 'Only Loan Officers and Branch Managers can generate client QR codes.',
        });
    }

    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    if (client.status !== 'active') {
        return res.status(200).json({
            success: false,
            message: 'QR codes can only be generated for active clients.',
        });
    }

    // rep=4 (LO): only for their own client.
    if (currentUser.role.rep === 4 && client.loId !== currentUser._id) {
        return res.status(200).json({
            success: false,
            message: 'You can only generate a QR code for your own client.',
        });
    }

    // rep=3 (BM/cashier): only within their own branch.
    if (currentUser.role.rep === 3 && client.branchId !== currentUser.designatedBranchId) {
        return res.status(200).json({
            success: false,
            message: 'You can only generate a QR code for clients in your branch.',
        });
    }

    const now     = moment();
    const qrToken = generateUUID();

    await graph.mutation(
        updateQl(CLIENT_TYPE, {
            where: { _id: { _eq: clientId } },
            set: {
                qrToken,
                qrGeneratedAt: now.toISOString(),
                qrGeneratedBy: currentUser._id,
            },
        })
    );

    const isRegeneration = !!client.qrToken;

    await logAudit(req, {
        action:      isRegeneration ? 'CLIENT_QR_REGENERATED' : 'CLIENT_QR_GENERATED',
        category:    'QR',
        severity:    'INFO',
        entityType:  'client',
        entityId:    clientId,
        description: `QR ${isRegeneration ? 'regenerated' : 'generated'} for client "${client.fullName || `${client.lastName}, ${client.firstName}`}" by ${currentUser.firstName} ${currentUser.lastName}`,
        afterData: {
            qrToken,
            clientName: client.fullName || `${client.lastName}, ${client.firstName}`,
            branchName: client.branch?.name,
        },
        branchId:   client.branchId,
        branchName: client.branch?.name,
    });

    return res.status(200).json({
        success: true,
        qr: {
            qrToken,
            qrGeneratedAt: now.toISOString(),
            clientId:      client._id,
            clientName:    client.fullName || `${client.lastName}, ${client.firstName}`,
            branchId:      client.branchId,
            branchName:    client.branch?.name,
            loId:          client.loId,
            loName:        client.lo ? `${client.lo.firstName} ${client.lo.lastName}` : null,
        },
        message: isRegeneration
            ? 'QR code regenerated. The previous QR code is now invalid.'
            : 'QR code generated successfully.',
    });
}