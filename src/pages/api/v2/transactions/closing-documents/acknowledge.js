// src/pages/api/v2/transactions/closing-documents/acknowledge.js
// The actual enforcement point: requires (a) a prior log-view record for
// this exact branch/date/docType/version/reviewer, and (b) AM+ role.
// One-way — no "un-acknowledge" endpoint, matching sign-off semantics.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const REVIEW_TYPE = createGraphType('closing_document_reviews', `_id`)('reviews');

// Same list as BRANCH_FINAL_CLOSE_ALLOWED_SHORTCODES in
// update-group-transaction-status.js — keep these two in sync if either
// changes. (Duplicated rather than shared across files because these are
// separate serverless routes in this Next.js API structure; a shared
// constants module would be the cleaner long-term fix if this list needs
// to change more than rarely.)
const REVIEW_ALLOWED_SHORTCODES = ['admin', 'deputy_director', 'regional_manager', 'area_admin'];

export default apiHandler({
    post: acknowledge,
});

async function acknowledge(req, res) {
    const { branchId, dateFor, docType, version } = req.body;
    const authenticatedUserId = req.auth?.sub;

    if (!authenticatedUserId) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!branchId || !dateFor || !docType || !version) {
        return res.status(200).json({ success: false, message: 'branchId, dateFor, docType and version are required.' });
    }

    try {
        const reviewer = await findUserById(authenticatedUserId);
        if (!reviewer?.role || !REVIEW_ALLOWED_SHORTCODES.includes(reviewer.role.shortCode)) {
            return res.status(403).json({ success: false, message: 'You are not authorized to acknowledge closing documents.' });
        }

        const existing = await graph.query(
            queryQl(
                createGraphType('closing_document_reviews', `_id acknowledged`)('reviews'),
                {
                    where: {
                        branch_id: { _eq: branchId },
                        date_for: { _eq: dateFor },
                        doc_type: { _eq: docType },
                        version: { _eq: version },
                        reviewed_by: { _eq: authenticatedUserId },
                    },
                },
            ),
        );
        const row = existing?.data?.reviews?.[0];

        // ENFORCED: cannot acknowledge without a prior logged view of this
        // exact version. This is what makes the checkbox a real gate rather
        // than a decorative one — the frontend also disables the checkbox
        // until a view is logged, but that's UX only; this is the actual
        // boundary.
        if (!row) {
            return res.status(200).json({ success: false, message: 'You must view this document before acknowledging it.' });
        }

        await graph.mutation(
            updateQl(REVIEW_TYPE, {
                set: {
                    acknowledged: true,
                    acknowledged_at: new Date().toISOString(),
                },
                where: { _id: { _eq: row._id } },
            }),
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error acknowledging document:', error.message);
        return res.status(200).json({ success: false, message: 'Error acknowledging document.' });
    }
}