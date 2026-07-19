// src/pages/api/v2/transactions/closing-documents/remove.js
// Soft-deletes (is_active: false) a specific uploaded file. Blocked once
// the branch has already been closed — deleting a file AM already
// reviewed/acknowledged would silently invalidate their approval without
// going through the reopen/stale/re-review flow that exists specifically
// to handle post-close corrections safely.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const UPLOAD_ALLOWED_SHORTCODES = ['admin', 'branch_manager'];

export default apiHandler({
    post: removeDocument,
});

async function removeDocument(req, res) {
    const { documentId, branchId, dateFor } = req.body;
    const authenticatedUserId = req.auth?.sub;

    if (!authenticatedUserId) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!documentId || !branchId || !dateFor) {
        return res.status(200).json({ success: false, message: 'documentId, branchId and dateFor are required.' });
    }

    try {
        const uploader = await findUserById(authenticatedUserId);
        if (!uploader?.role || !UPLOAD_ALLOWED_SHORTCODES.includes(uploader.role.shortCode)) {
            return res.status(403).json({ success: false, message: 'You are not authorized to remove closing documents.' });
        }

        // ENFORCED: block deletion once the branch is closed. This is the
        // actual security boundary — the frontend also hides/disables the
        // Remove button in this state, but that's UX only, not the gate.
        const approval = await graph.query(
            queryQl(
                createGraphType('branchApprovals', `status`)('approvals'),
                { where: { branchId: { _eq: branchId }, dateFor: { _eq: dateFor } } },
            ),
        );
        if (approval?.data?.approvals?.[0]?.status === 'closed') {
            return res.status(200).json({
                success: false,
                message: 'This branch is already closed. Reopen the affected Loan Officer transaction to make changes to closing documents.',
            });
        }

        // Verify the document actually belongs to this branch/date before
        // touching it — never trust a client-supplied documentId blindly.
        const existing = await graph.query(
            queryQl(
                createGraphType('closing_documents', `_id branch_id date_for`)('closingDocuments'),
                { where: { _id: { _eq: documentId } } },
            ),
        );
        const doc = existing?.data?.closingDocuments?.[0];
        if (!doc || doc.branch_id !== branchId || doc.date_for !== dateFor) {
            return res.status(200).json({ success: false, message: 'Document not found for this branch/date.' });
        }

        await graph.mutation(
            updateQl(
                createGraphType('closing_documents', `_id`)('closingDocuments'),
                { set: { is_active: false }, where: { _id: { _eq: documentId } } },
            ),
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error removing closing document:', error.message);
        return res.status(200).json({ success: false, message: 'Error removing closing document.' });
    }
}