// src/pages/api/v2/transactions/closing-documents/upload.js

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { CLOSING_DOC_KEYS } from '@/lib/closing-documents.constants';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const CLOSING_DOC_TYPE = createGraphType('closing_documents', `_id`)('closingDocuments');

// CHANGED: previously included area_admin/regional_manager/deputy_director
// alongside branch_manager. That let AM+ upload a document AND then
// acknowledge their own upload — the same self-certification problem the
// finalize-permission split (BRANCH_FINAL_CLOSE_ALLOWED_SHORTCODES in
// update-group-transaction-status.js) was built to prevent, just one step
// earlier in the workflow. Upload is now restricted to the preparer role
// (branch_manager) plus admin as a full override for genuine exceptions —
// if an AM spots a bad file, the correct path is admin re-upload or kicking
// it back to BM, not the reviewer quietly doing both halves of the control.
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

    // CHANGED: role is an embedded JSON object on the user record
    // ({_id, rep, shortCode, ...}), confirmed via actual sample data — not a
    // foreign key requiring a lookup against a separate "roles" table.
    if (!uploader?.role || !CLOSING_DOC_UPLOAD_ALLOWED_SHORTCODES.includes(uploader.role.shortCode)) {
        return res.status(403).json({ success: false, message: 'You are not authorized to upload closing documents.' });
    }

    const uploadedBy = uploader._id;
    const uploadedByName = `${uploader.firstName} ${uploader.lastName}`;

    try {
        // Deactivate any existing active version for this branch/date/docType
        // CHANGED: was querying/deactivating "the" active row for this
        // doc_type, assuming exactly one existed. Now multiple files can be
        // simultaneously active per type, so this queries ALL active rows
        // to find the current max version — no deactivation happens here
        // anymore, every upload is additive.
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