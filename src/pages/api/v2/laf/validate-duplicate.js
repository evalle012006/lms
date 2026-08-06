// src/pages/api/v2/laf/validate-duplicate.js
// POST { ciReferenceCode, action: 'approve' | 'decline', note? }
// Admin-only (rep=1, regional_manager, deputy_director).
// Validates a duplicate-flagged LAF application.
// approve → sets status back to ci_approved so BM can promote
// decline → sets status to ci_declined

import { apiHandler }                         from '@/services/api-handler';
import { GraphProvider }                      from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS }               from '@/lib/graph.fields';
import { findUserById }                       from '@/lib/graph.functions';
import { logAudit }                           from '@/lib/audit';
import moment                                 from 'moment';

const graph = new GraphProvider();
const TEMP_TYPE = createGraphType(
    'temporaryLoanApplications', TEMP_LOAN_APP_FIELDS
)('temporaryLoanApplications');

export default apiHandler({ post: validateDuplicate });

async function validateDuplicate(req, res) {
    const { ciReferenceCode, action, note } = req.body;

    if (!ciReferenceCode || !action) {
        return res.status(200).json({ success: false, message: 'ciReferenceCode and action required.' });
    }
    if (!['approve', 'decline'].includes(action)) {
        return res.status(200).json({ success: false, message: 'action must be "approve" or "decline".' });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    // Role check — admin (rep=1) only
    const isAdmin = currentUser.role?.rep === 1 || currentUser.root === true || currentUser.role?.rep === 3; // allow BM (rep=3) to validate duplicates
    if (!isAdmin) {
        return res.status(200).json({
            success: false,
            message: 'Only system administrators can validate duplicate applications.',
        });
    }

    // Fetch application
    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'Application not found.' });
    }
    if (!application.isDuplicateFlagged) {
        return res.status(200).json({ success: false, message: 'This application is not flagged for duplicate validation.' });
    }
    if (application.status !== 'pending_validation') {
        return res.status(200).json({
            success: false,
            message: `Application status is "${application.status}" — cannot validate.`,
        });
    }

    const newStatus = action === 'approve' ? 'ci_approved' : 'ci_declined';

    await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: { ciReferenceCode: { _eq: ciReferenceCode } },
            set: {
                status:                   newStatus,
                duplicateValidatedBy:     currentUser._id,
                duplicateValidatedAt:     moment().toISOString(),
                duplicateValidationNote:  note || null,
            },
        })
    );

    await logAudit(req, {
        action:      `DUPLICATE_${action.toUpperCase()}D`,
        category:    'LAF',
        severity:    action === 'decline' ? 'WARNING' : 'INFO',
        entityType:  'temporaryLoanApplication',
        entityId:    application._id,
        description: `Duplicate application ${action}d by ${currentUser.firstName} ${currentUser.lastName}: ${ciReferenceCode}`,
        branchId:    application.branchId,
        metadata:    { ciReferenceCode, action, note, newStatus },
    });

    return res.status(200).json({
        success: true,
        message: action === 'approve'
            ? 'Application approved. Branch manager can now promote this client.'
            : 'Application declined.',
        newStatus,
    });
}