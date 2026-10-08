// src/pages/api/v2/laf/revert-promotion.js
// POST { ciReferenceCode, reason }
// Admin, supervisor, or branch manager. Reverts a 'promoted' application.
//   - existingClientId was null (prospect)  → snapshot + hard-delete client, LAF, CI investigation
//   - existingClientId was set (reloan/pending/balik) → revert client.status (balik only), no delete
//
// Loan guard (all branches): a linked loan blocks revert ONLY if it has moved
// past 'pending' (active/completed/closed/etc.) — nothing irreversible has
// happened to a pending loan yet, so revert stays safe. If a pending loan
// IS linked, it gets rejected (status → 'reject') as part of the revert, so
// it doesn't end up an orphaned pending record pointing at a reverted/deleted
// promotion.
//
// OPEN QUESTION (not yet confirmed): does flipping a loan to status='reject'
// have any side effects elsewhere (group slot availability, cash-collections)
// that need to be mirrored here? Not verified — see conversation. Proceeding
// on the assumption that a bare status/rejectReason update is sufficient.

import { apiHandler }       from '@/services/api-handler';
import { GraphProvider }    from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, deleteQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS, CLIENT_FIELDS } from '@/lib/graph.fields';
import { findUserById }     from '@/lib/graph.functions';
import { logAudit }         from '@/lib/audit';
import moment from 'moment';

const graph = new GraphProvider();
const TEMP_TYPE   = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');
const CI_TYPE     = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const LOAN_TYPE = createGraphType('loans', '_id status ciReferenceCode clientId pnNumber slotNo groupId')('loans');

export default apiHandler({ post: revertPromotion });

// Reject a pending loan as part of a revert — avoids leaving a pending loan
// record orphaned/pointing at a promotion that no longer exists in its
// promoted state.
async function rejectPendingLoan(loanId, reason, userId) {
    await graph.mutation(
        updateQl(LOAN_TYPE, {
            where: { _id: { _eq: loanId } },
            set: {
                status:           'reject',
                rejectReason:     `Promotion reverted: ${reason}`,
                modifiedBy:       userId,
                modifiedDateTime: new Date(),
            },
        })
    );
}

// New helper — mirrors updateGroup() in transactions/loans/save.js, reversed.
// Adds the loan's slotNo back into the group's availableSlots and decrements
// noOfClients. If the group was 'full', reopens it to 'available'.
// Only called for balik/prospect reverts, where a NEW slot was reserved by
// this promotion — reloan/pending/existing clients keep their existing slot,
// so nothing needs to be freed for them.
async function freeGroupSlot(groupId, slotNo) {
    if (!groupId || slotNo == null) return;

    const [group] = await graph.query(
        queryQl(createGraphType('groups', '_id availableSlots noOfClients capacity status')('groups'), {
            where: { _id: { _eq: groupId } },
        })
    ).then(r => r.data?.groups ?? []);

    if (!group) return;

    const availableSlots = Array.isArray(group.availableSlots) ? [...group.availableSlots] : [];
    if (!availableSlots.includes(slotNo)) {
        availableSlots.push(slotNo);
    }

    const noOfClients = Math.max((group.noOfClients || 0) - 1, 0);
    const status = group.status === 'full' ? 'available' : group.status;

    await graph.mutation(
        updateQl(createGraphType('groups', '_id')('groups'), {
            where: { _id: { _eq: groupId } },
            set: { availableSlots, noOfClients, status },
        })
    );
}

async function revertPromotion(req, res) {
    const { ciReferenceCode, reason } = req.body;
    if (!ciReferenceCode) return res.status(200).json({ success: false, message: 'ciReferenceCode required.' });
    if (!reason?.trim())  return res.status(200).json({ success: false, message: 'A reason is required to revert a promotion.' });

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    // Same role model as validate-duplicate.js / pending-validation-list.js
    const isAdmin      = currentUser.role?.rep === 1 || currentUser.root === true;
    const isSupervisor = currentUser.role?.rep === 2 &&
        (currentUser.role?.shortCode === 'deputy_director' || currentUser.role?.shortCode === 'regional_manager'
            || currentUser.role?.shortCode === 'area_admin'
        );
    const isBM = currentUser.role?.shortCode === 'branch_manager';

    if (!isAdmin && !isSupervisor && !isBM) {
        return res.status(200).json({
            success: false,
            message: 'Only branch managers, supervisors, or administrators can revert a promotion.',
        });
    }

    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) return res.status(200).json({ success: false, message: 'Application not found.' });
    if (application.status !== 'promoted') {
        return res.status(200).json({ success: false, message: `Cannot revert — status is "${application.status}", not "promoted".` });
    }

    const isProspectGhost = !application.existingClientId && !!application.promotedClientId;

    if (isProspectGhost) {
        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: application.promotedClientId } } })
        ).then(r => r.data?.clients ?? []);

        // ── Guard: a non-pending loan on this client blocks the delete ────
        // A promoted prospect who already has an active/completed loan is no
        // longer a simple "ghost" — deleting the client would orphan real
        // transaction history. A pending loan, however, hasn't disbursed
        // anything yet — safe to reject-and-revert.
        const [existingLoan] = await graph.query(
            queryQl(LOAN_TYPE, { where: { clientId: { _eq: application.promotedClientId } }, limit: 1 })
        ).then(r => r.data?.loans ?? []);

        if (existingLoan && existingLoan.status !== 'pending') {
            return res.status(200).json({
                success: false,
                message: 'This client already has an active or completed loan on file. This can no longer be reverted '
                    + 'as a simple ghost-client cleanup — please handle it through the loan '
                    + 'cancellation process instead.',
            });
        }

        // Reject the pending loan BEFORE the client record is deleted below,
        // so it never ends up pointing at a client that no longer exists.
        if (existingLoan) {
            await rejectPendingLoan(existingLoan._id, reason.trim(), currentUser._id);
            await freeGroupSlot(existingLoan.groupId, existingLoan.slotNo);
        }

        const [investigation] = await graph.query(
            queryQl(CI_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
        ).then(r => r.data?.ciInvestigations ?? []);

        // ── Snapshot BEFORE delete — this is the audit trail ──────────────
        // OPEN QUESTION (not yet confirmed): should existingLoan's pre-revert
        // state also be captured here, now that this action actively mutates
        // it (reject)? Not included below — beforeData only covers
        // client/application/investigation, matching the pre-existing shape.
        await logAudit(req, {
            action:      'LAF_PROMOTION_REVERTED_GHOST_CLIENT',
            category:    'CI',
            severity:    'CRITICAL',
            entityType:  'client',
            entityId:    application.promotedClientId,
            description: `Ghost client cleanup: ${client?.firstName} ${client?.lastName} `
                + `(CI ${ciReferenceCode}) permanently deleted by ${currentUser.firstName} ${currentUser.lastName}. Reason: ${reason.trim()}`
                + (existingLoan ? ` Linked pending loan (${existingLoan.pnNumber || existingLoan._id}) rejected as part of this revert.` : ''),
            beforeData:  { client, application, investigation },
            afterData:   null,
            metadata:    { ciReferenceCode, revertedBy: currentUser._id, reason: reason.trim(), rejectedLoanId: existingLoan?._id || null },
            branchId:    application.branchId,
            userId:      currentUser._id,
            userName:    `${currentUser.firstName} ${currentUser.lastName}`,
        });

        // ── Cascade delete — client, LAF, CI investigation ────────────────
        // NOTE: DO Spaces file keys (lafPhotoKey, governmentIdPhotoKey, selfieKey)
        // are intentionally NOT deleted from storage — keeping the files is cheap,
        // and the audit snapshot above already captured their keys for reference.
        if (client) {
            await graph.mutation(deleteQl(CLIENT_TYPE, { _id: { _eq: client._id } }));
        }
        if (investigation) {
            await graph.mutation(deleteQl(CI_TYPE, { ciReferenceCode: { _eq: ciReferenceCode } }));
        }
        await graph.mutation(
            updateQl(TEMP_TYPE, {
                where: { ciReferenceCode: { _eq: ciReferenceCode } },
                set:   {
                    status: 'reverted',
                    revertedAt: moment().toISOString(),
                    revertedBy: currentUser._id,
                    revertReason: reason.trim(),
                },
            })
        );

        return res.status(200).json({ success: true, deleted: true, message: 'Ghost client record removed.' });
    }

    // ── Existing client (reloan/pending/existing/balik) ────────────────────
    // Loan guard applies to ALL of these client types now, not just balik —
    // a linked loan blocks revert only once it's past 'pending'.
    const [existingLoan] = await graph.query(
        queryQl(LOAN_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } }, limit: 1 })
    ).then(r => r.data?.loans ?? []);

    if (existingLoan && existingLoan.status !== 'pending') {
        return res.status(200).json({
            success: false,
            message: 'A loan has already been created and is active or completed for this client under this application. '
                + 'This can no longer be reverted automatically — please handle it through the loan cancellation process instead.',
        });
    }

    if (existingLoan) {
        await rejectPendingLoan(existingLoan._id, reason.trim(), currentUser._id);
        if (application.clientType === 'balik') {
            await freeGroupSlot(existingLoan.groupId, existingLoan.slotNo);
        }
    }

    // Per business rule: status only flips offset → pending when a loan is
    // actually created, not at promotion itself. Balik-specific — reloan/
    // pending/existing clients have no such status to revert.
    if (application.clientType === 'balik') {
        await graph.mutation(
            updateQl(CLIENT_TYPE, {
                where: { _id: { _eq: application.existingClientId } },
                set:   { status: 'offset' },
            })
        );
    }

    await logAudit(req, {
        action:      'LAF_PROMOTION_REVERTED_EXISTING_CLIENT',
        category:    'CI',
        severity:    'WARNING',
        entityType:  'client',
        entityId:    application.existingClientId,
        description: `Promotion reverted for existing client (CI ${ciReferenceCode}) by `
            + `${currentUser.firstName} ${currentUser.lastName}. Reason: ${reason.trim()}`
            + (existingLoan ? ` Linked pending loan (${existingLoan.pnNumber || existingLoan._id}) rejected as part of this revert.` : ''),
        metadata: { ciReferenceCode, revertedBy: currentUser._id, reason: reason.trim(), rejectedLoanId: existingLoan?._id || null },
        branchId: application.branchId,
        userId:   currentUser._id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
    });

    await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: { ciReferenceCode: { _eq: ciReferenceCode } },
            set:   {
                status: 'reverted',
                revertedAt: moment().toISOString(),
                revertedBy: currentUser._id,
                revertReason: reason.trim(),
            },
        })
    );

    return res.status(200).json({ success: true, deleted: false, message: 'Promotion reverted.' });
}