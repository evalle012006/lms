// src/pages/api/v2/laf/revert-promotion.js
// POST { ciReferenceCode, reason }
// Admin, supervisor, or branch manager. Reverts a 'promoted' application.
//   - existingClientId was null (prospect)  → snapshot + hard-delete client, LAF, CI investigation
//   - existingClientId was set (reloan/pending/balik) → revert client.status, no delete
//     (Balik only, and only if no loan has been created yet under this application —
//      see loan-existence guard below)

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

export default apiHandler({ post: revertPromotion });

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

        // ── Guard: any loan on this client blocks the delete ──────────────
        // A promoted prospect who already has a loan attached is no longer a
        // simple "ghost" — deleting the client would orphan the loan record.
        const [existingLoan] = await graph.query(
            queryQl(
                createGraphType('loans', '_id status clientId')('loans'),
                { where: { clientId: { _eq: application.promotedClientId } }, limit: 1 }
            )
        ).then(r => r.data?.loans ?? []);

        if (existingLoan) {
            return res.status(200).json({
                success: false,
                message: 'This client already has a loan on file. This can no longer be reverted '
                    + 'as a simple ghost-client cleanup — please handle it through the loan '
                    + 'cancellation process instead.',
            });
        }

        const [investigation] = await graph.query(
            queryQl(CI_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
        ).then(r => r.data?.ciInvestigations ?? []);

        // ── Snapshot BEFORE delete — this is the audit trail ──────────────
        await logAudit(req, {
            action:      'LAF_PROMOTION_REVERTED_GHOST_CLIENT',
            category:    'CI',
            severity:    'CRITICAL',
            entityType:  'client',
            entityId:    application.promotedClientId,
            description: `Ghost client cleanup: ${client?.firstName} ${client?.lastName} `
                + `(CI ${ciReferenceCode}) permanently deleted by ${currentUser.firstName} ${currentUser.lastName}. Reason: ${reason.trim()}`,
            beforeData:  { client, application, investigation },
            afterData:   null,
            metadata:    { ciReferenceCode, revertedBy: currentUser._id, reason: reason.trim() },
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

    // ── Existing client — revert status, no delete ────────────────────────
    if (application.clientType === 'balik') {
        // Per business rule: status only flips offset → pending when a loan is
        // actually created, not at promotion itself. Reverting is only safe if
        // no loan was ever created under this application — otherwise there's
        // real transaction history a status flip can't undo.
        const [existingLoan] = await graph.query(
            queryQl(
                createGraphType('loans', '_id status ciReferenceCode')('loans'),
                { where: { ciReferenceCode: { _eq: ciReferenceCode } }, limit: 1 }
            )
        ).then(r => r.data?.loans ?? []);

        if (existingLoan) {
            return res.status(200).json({
                success: false,
                message: 'A loan has already been created for this client under this application. '
                    + 'This can no longer be reverted automatically — please handle it through the loan cancellation process instead.',
            });
        }

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
            + `${currentUser.firstName} ${currentUser.lastName}. Reason: ${reason.trim()}`,
        metadata: { ciReferenceCode, revertedBy: currentUser._id, reason: reason.trim() },
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