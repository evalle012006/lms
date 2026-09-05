// src/pages/api/v2/laf/link-to-client.js
// POST { ciReferenceCode, existingClientId }
//
// Called when admin confirms "Same Person — Link to this Client" in CIDuplicatePanel.
// This is NOT a client merge — it only updates the temporaryLoanApplication to point
// to an existing client and converts it to a reloan or pending (resolved from the
// client's actual loan status) so CI can proceed normally.
//
// FIX: previously hardcoded clientType: 'reloan' regardless of the matched client's
// actual loan status — a client with only a completed loan would be silently
// miscategorized as reloan instead of pending, which affects downstream loan-term
// and Date-of-Release rules. Now resolves reloan vs pending the same way
// lookup-client.js's mode=existing does, using the client's actual loans, not the
// client's top-level status field (which is a different thing entirely).
//
// The other duplicate candidates are completely untouched.
// clients/merge (which re-links loans between two existing client records) is a
// separate, more destructive operation and is NOT called here.

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';

import moment        from 'moment';
import { logAudit } from '@/lib/audit';

const graph = new GraphProvider();

const TEMP_TYPE   = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

// FIX: added loans join — client.status alone doesn't tell us active vs
// completed loan, which is what actually determines reloan vs pending.
const CLIENT_TYPE = createGraphType('clients', `
    _id firstName lastName status
    loans (
        where: { status: { _neq: "reject" } }
        order_by: [{ insertedDateTime: desc, loanCycle: desc }]
        limit: 5
    ) {
        _id status
    }
`)('clients');

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

    // ── Resolve reloan vs pending from the client's actual loan status ────
    // Same resolution rule as lookup-client.js's mode=existing — never assume
    // "reloan" just because that's the common case.
    const loans            = client.loans || [];
    const hasActiveLoan    = loans.some(l => l.status === 'active');
    const hasCompletedLoan = loans.some(l => l.status === 'completed');

    if (hasActiveLoan && hasCompletedLoan) {
        return res.status(200).json({
            success: false,
            message: `This client has conflicting loan records (both active and completed). `
                + `This must be resolved by an administrator before linking.`,
        });
    }

    const resolvedClientType = hasActiveLoan ? 'reloan' : hasCompletedLoan ? 'pending' : null;

    if (!resolvedClientType) {
        return res.status(200).json({
            success: false,
            message: `This client has no active or completed loan on file — cannot determine `
                + `whether this should be a reloan or pending application. Please verify manually.`,
        });
    }

    const now = moment().toISOString();

    // Link the LAF to the existing client, resolved type, reset to pending
    // so BM can complete CI investigation normally. Clear duplicate flags.
    await graph.mutation(
        updateQl(
            createGraphType('temporaryLoanApplications', '_id')('temporaryLoanApplications'),
            {
                where: { ciReferenceCode: { _eq: ciReferenceCode } },
                set: {
                    existingClientId:    existingClientId,
                    clientType:          resolvedClientType,
                    status:              'pending',
                    isDuplicateFlagged:       false,
                    duplicateCandidateIds:    [],
                    duplicateValidatedBy:     currentUser._id,
                    duplicateValidatedAt:     now,
                    duplicateValidationNote:  `Linked to existing client ${client.firstName} ${client.lastName} (${existingClientId}) as ${resolvedClientType} by admin.`,
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
        description: `LAF ${ciReferenceCode} linked to existing client ${client.firstName} ${client.lastName} (${existingClientId}) as ${resolvedClientType}. Duplicate flag cleared. Other ${(application.duplicateCandidateIds?.length || 1) - 1} candidate(s) left untouched.`,
        metadata:    { ciReferenceCode, existingClientId, clientStatus: client.status, resolvedClientType },
    });

    return res.status(200).json({
        success:            true,
        ciReferenceCode,
        existingClientId,
        resolvedClientType,
        clientName:         `${client.firstName} ${client.lastName}`,
        message:            `LAF linked to ${client.firstName} ${client.lastName} as a ${resolvedClientType}. Branch manager can now complete the CI investigation.`,
    });
}