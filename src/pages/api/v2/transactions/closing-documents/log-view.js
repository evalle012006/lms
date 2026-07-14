// src/pages/api/v2/transactions/closing-documents/log-view.js
// Fire-and-forget from the frontend when AM clicks "View uploaded".
// This is the audit trail, not the gate — acknowledge.js is the gate, and
// it requires a view record to exist here first.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const REVIEW_TYPE = createGraphType('closing_document_reviews', `_id`)('reviews');

export default apiHandler({
    post: logView,
});

async function logView(req, res) {
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
        const now = new Date().toISOString();

        const existing = await graph.query(
            queryQl(
                createGraphType('closing_document_reviews', `_id view_count`)('reviews'),
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

        if (row) {
            await graph.mutation(
                updateQl(REVIEW_TYPE, {
                    set: {
                        last_viewed_at: now,
                        view_count: (row.view_count || 0) + 1,
                    },
                    where: { _id: { _eq: row._id } },
                }),
            );
        } else {
            await graph.mutation(
                insertQl(REVIEW_TYPE, {
                    objects: [{
                        branch_id: branchId,
                        date_for: dateFor,
                        doc_type: docType,
                        version,
                        reviewed_by: authenticatedUserId,
                        reviewed_by_name: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
                        first_viewed_at: now,
                        last_viewed_at: now,
                        view_count: 1,
                        acknowledged: false,
                    }],
                }),
            );
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error logging document view:', error.message);
        return res.status(200).json({ success: false, message: 'Error logging document view.' });
    }
}