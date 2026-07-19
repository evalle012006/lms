// src/pages/api/v2/transactions/closing-documents/upload.js

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { CLOSING_DOC_KEYS } from '@/lib/closing-documents.constants';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const CLOSING_DOC_TYPE = createGraphType('closing_documents', `_id`)('closingDocuments');

const CLOSING_DOC_UPLOAD_ALLOWED_SHORTCODES = [
    'admin', 'branch_manager'
];

export default apiHandler({
    post: saveClosingDocument,
});

async function saveClosingDocument(req, res) {
    const { branchId, dateFor, docType, fileKey } = req.body;
    const authenticatedUserId = req.auth?.sub;

    if (!authenticatedUserId) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    if (!branchId || !dateFor || !docType || !fileKey) {
        return res.status(200).json({ success: false, message: 'branchId, dateFor, docType and fileKey are required.' });
    }

    if (!CLOSING_DOC_KEYS.includes(docType)) {
        return res.status(200).json({ success: false, message: `Invalid docType: ${docType}` });
    }

    const uploader = await findUserById(authenticatedUserId);

    if (!uploader?.role || !CLOSING_DOC_UPLOAD_ALLOWED_SHORTCODES.includes(uploader.role.shortCode)) {
        return res.status(403).json({ success: false, message: 'You are not authorized to upload closing documents.' });
    }

    const uploadedBy = uploader._id;
    const uploadedByName = `${uploader.firstName} ${uploader.lastName}`;

    try {
        // ADDED: this was the actual gap — remove.js has always checked
        // this, upload.js never did. That asymmetry is exactly what
        // produced the orphaned-file scenario during Replace testing:
        // the upload half of Replace succeeded on a closed branch with no
        // check at all, and only the subsequent remove call (which does
        // check) correctly failed, leaving two active files behind. This
        // closes the actual gap — the client-side branchClosed gating is
        // UX only, this is the real boundary, same as remove.js.
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

        // CHANGED: comment previously said "Deactivate any existing active
        // version" — stale leftover from before multi-file support. This
        // no longer deactivates anything; every upload is additive, and
        // this query only exists to find the current max version.
        const existing = await graph.query(
            queryQl(
                createGraphType('closing_documents', `version`)('closingDocuments'),
                {
                    where: {
                        branch_id: { _eq: branchId },
                        date_for: { _eq: dateFor },
                        doc_type: { _eq: docType },
                        is_active: { _eq: true },
                    },
                },
            ),
        );

        const existingVersions = (existing?.data?.closingDocuments || []).map(d => d.version);
        const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;

        const inserted = await graph.mutation(
            insertQl(CLOSING_DOC_TYPE, {
                objects: [{
                    branch_id: branchId,
                    date_for: dateFor,
                    doc_type: docType,
                    file_key: fileKey,
                    version: nextVersion,
                    is_active: true,
                    uploaded_by: uploadedBy,
                    uploaded_by_name: uploadedByName,
                    uploaded_at: new Date().toISOString(),
                }],
            }),
        );

        if (inserted?.data?.closingDocuments?.affected_rows > 0) {
            return res.status(200).json({ success: true, version: nextVersion });
        }

        return res.status(200).json({ success: false, message: 'Failed to save closing document.' });
    } catch (error) {
        console.error('Error saving closing document:', error.message);
        return res.status(200).json({ success: false, message: 'Error saving closing document.' });
    }
}