// src/pages/api/v2/transactions/closing-documents/list.js

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const CLOSING_DOC_TYPE = createGraphType(
    'closing_documents',
    `_id doc_type file_key version uploaded_by uploaded_by_name uploaded_at`,
)('closingDocuments');

const REVIEW_TYPE = createGraphType(
    'closing_document_reviews',
    `doc_type version acknowledged acknowledged_at reviewed_by_name first_viewed_at last_viewed_at view_count`,
)('reviews');

export default apiHandler({
    get: listClosingDocuments,
});

async function listClosingDocuments(req, res) {
    const { branchId, dateFor } = req.query;
    const authenticatedUserId = req.auth?.sub;

    if (!branchId || !dateFor) {
        return res.status(200).json({ success: false, message: 'branchId and dateFor are required.' });
    }

    try {
        const result = await graph.query(
            queryQl(CLOSING_DOC_TYPE, {
                where: {
                    branch_id: { _eq: branchId },
                    date_for: { _eq: dateFor },
                    is_active: { _eq: true },
                },
            }),
        );

        const rawDocs = result?.data?.closingDocuments || [];

        let reviewsByDocVersion = {};
        if (authenticatedUserId && rawDocs.length > 0) {
            const reviewResult = await graph.query(
                queryQl(REVIEW_TYPE, {
                    where: {
                        branch_id: { _eq: branchId },
                        date_for: { _eq: dateFor },
                        reviewed_by: { _eq: authenticatedUserId },
                        _or: rawDocs.map(d => ({
                            _and: [
                                { doc_type: { _eq: d.doc_type } },
                                { version: { _eq: d.version } },
                            ],
                        })),
                    },
                }),
            );
            (reviewResult?.data?.reviews || []).forEach(r => {
                reviewsByDocVersion[`${r.doc_type}::${r.version}`] = r;
            });
        }

        // CHANGED: added `status` to this selection — it was previously
        // only fetching staleAt/documentsStale, so this endpoint had no
        // way to know or report whether the branch was actually closed.
        // That's why branchClosed never appeared in the response despite
        // being referenced everywhere on the frontend.
        const approvalResult = await graph.query(
            queryQl(
                createGraphType('branchApprovals', `status staleAt documentsStale`)('approvals'),
                {
                    where: {
                        branchId: { _eq: branchId },
                        dateFor: { _eq: dateFor },
                    },
                },
            ),
        );
        const approvalRow = approvalResult?.data?.approvals?.[0];
        const staleAt = approvalRow?.documentsStale ? approvalRow?.staleAt : null;
        // ADDED — the actual field the modal reads to gate
        // Remove/Replace/Add File(s)/Upload selected.
        const branchClosed = approvalRow?.status === 'closed';

        const documentsByType = {};
        rawDocs.forEach(d => {
            const review = reviewsByDocVersion[`${d.doc_type}::${d.version}`];
            const predatesReopen = staleAt && new Date(d.uploaded_at) < new Date(staleAt);
            const shaped = {
                id: d._id,
                docType: d.doc_type,
                fileKey: d.file_key,
                version: d.version,
                uploadedBy: d.uploaded_by,
                uploadedByName: d.uploaded_by_name,
                uploadedAt: d.uploaded_at,
                acknowledged: review?.acknowledged || false,
                viewedAt: review?.first_viewed_at || null,
                viewCount: review?.view_count || 0,
                acknowledgedAt: review?.acknowledged_at || null,
                reviewedByName: review?.reviewed_by_name || null,
                predatesReopen,
            };
            if (!documentsByType[d.doc_type]) documentsByType[d.doc_type] = [];
            documentsByType[d.doc_type].push(shaped);
        });

        Object.values(documentsByType).forEach(arr => arr.sort((a, b) => b.version - a.version));

        // CHANGED: branchClosed added to the response.
        return res.status(200).json({ success: true, documentsByType, branchClosed });
    } catch (error) {
        console.error('Error listing closing documents:', error.message);
        return res.status(200).json({ success: false, message: 'Error listing closing documents.' });
    }
}