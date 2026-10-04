// Requires a prior log-view row for this loan/reviewer — same shape as
// closing-documents/acknowledge.js. AM+ only.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();
const REVIEW_TYPE = createGraphType('loan_closing_reviews', `_id`)('reviews');

// Same list as BRANCH_FINAL_CLOSE_ALLOWED_SHORTCODES / REVIEW_ALLOWED_SHORTCODES
// elsewhere — keep in sync if either changes.
const REVIEW_ALLOWED_SHORTCODES = ['admin', 'deputy_director', 'regional_manager', 'area_admin'];

export default apiHandler({ post: acknowledge });

async function acknowledge(req, res) {
    const { branchId, dateFor, loanId } = req.body;
    const authenticatedUserId = req.auth?.sub;

    if (!authenticatedUserId) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!branchId || !dateFor || !loanId) {
        return res.status(200).json({ success: false, message: 'branchId, dateFor and loanId are required.' });
    }

    try {
        const reviewer = await findUserById(authenticatedUserId);
        if (!reviewer?.role || !REVIEW_ALLOWED_SHORTCODES.includes(reviewer.role.shortCode)) {
            return res.status(403).json({ success: false, message: 'You are not authorized to acknowledge loan verification.' });
        }

        const existing = await graph.query(
            queryQl(createGraphType('loan_closing_reviews', `_id`)('reviews'), {
                where: { branch_id: { _eq: branchId }, date_for: { _eq: dateFor }, loan_id: { _eq: loanId }, reviewed_by: { _eq: authenticatedUserId } },
            }),
        );
        const row = existing?.data?.reviews?.[0];

        if (!row) {
            return res.status(200).json({ success: false, message: 'You must view this loan before acknowledging it.' });
        }

        await graph.mutation(
            updateQl(REVIEW_TYPE, {
                set: { acknowledged: true, acknowledged_at: new Date().toISOString() },
                where: { _id: { _eq: row._id } },
            }),
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error acknowledging loan verification:', error.message);
        return res.status(200).json({ success: false, message: 'Error acknowledging.' });
    }
}