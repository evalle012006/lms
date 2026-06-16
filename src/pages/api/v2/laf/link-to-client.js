// src/pages/api/v2/laf/link-to-client.js
// POST { ciReferenceCode, existingClientId }
//
// Called when admin confirms "Same Person — Link to this Client" in CIDuplicatePanel.
// This is NOT a client merge — it only updates the temporaryLoanApplication to point
// to an existing client and converts it to a reloan so CI can proceed normally.
//
// The other duplicate candidates are completely untouched.
// clients/merge (which re-links loans between two existing client records) is a
// separate, more destructive operation and is NOT called here.

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { logAudit }  from '@/lib/audit-logger';
import moment        from 'moment';

const graph = new GraphProvider();

const TEMP_TYPE   = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CLIENT_TYPE = createGraphType('clients', '_id firstName lastName status')('clients');

export default apiHandler({ post: linkToClient });

async function linkToClient(req, res) {
    const currentUser = req.auth;
    const { ciReferenceCode, existingClientId } = req.body;

    if (!ciReferenceCode || !existingClientId) {
        return res.status(200).json({
            success: false,
            message: 'ciReferenceCode and existingClientId are required.',
        });
    }

    // Verify the LAF exists and is pending_validation
    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'Application not found.' });
    }
    if (application.status !== 'pending_validation') {
        return res.status(200).json({
            success: false,
            message: `Application is not pending validation (current status: ${application.status}).`,
        });
    }

    // Verify the existing client exists and is linkable
    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: existingClientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) {
        return res.status(200).json({ success: false, message: 'Existing client not found.' });
    }
    if (['merged', 'archived'].includes(client.status)) {
        return res.status(200).json({
            success: false,
            message: `Cannot link to a ${client.status} client record.`,
        });
    }

    const now = moment().toISOString();

    // Link the LAF to the existing client as a reloan
    // Clear duplicate flags so it appears as a normal pending CI
    await graph.mutation(
        updateQl(
            createGraphType('temporaryLoanApplications', '_id')(  'temporaryLoanApplications'),
            {
                where: { ciReferenceCode: { _eq: ciReferenceCode } },
                set: {
                    // Link to existing client
                    existingClientId:    existingClientId,
                    clientType:          'reloan',
                    // Reset to pending so BM can complete CI investigation normally
                    status:              'pending',
                    // Clear duplicate flags
                    isDuplicateFlagged:       false,
                    duplicateCandidateIds:    [],
                    // Record who validated and when
                    duplicateValidatedBy:     currentUser._id,
                    duplicateValidatedAt:     now,
                    duplicateValidationNote:  `Linked to existing client ${client.firstName} ${client.lastName} (${existingClientId}) by admin.`,
                },
            }
        )
    );

    await logAudit(req, {
        action:      'LAF_LINKED_TO_CLIENT',
        category:    'CLIENT',
        severity:    'INFO',
        entityType:  'temporaryLoanApplication',
        entityId:    ciReferenceCode,
        description: `LAF ${ciReferenceCode} linked to existing client ${client.firstName} ${client.lastName} (${existingClientId}) as reloan. Duplicate flag cleared. Other ${(application.duplicateCandidateIds?.length || 1) - 1} candidate(s) left untouched.`,
        metadata:    { ciReferenceCode, existingClientId, clientStatus: client.status },
    });

    return res.status(200).json({
        success:         true,
        ciReferenceCode,
        existingClientId,
        clientName:      `${client.firstName} ${client.lastName}`,
        message:         `LAF linked to ${client.firstName} ${client.lastName} as a reloan. Branch manager can now complete the CI investigation.`,
    });
}