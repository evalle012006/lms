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

        // CHANGED: keyed by `${docType}::${version}`, not docType alone —
        // the old keying was already wrong (if any doc_type ever had more
        // than one review row across versions, one silently overwrote the
        // other in this map), it just never surfaced with exactly one
        // active file per type. Multiple simultaneous files per type makes
        // that collision guaranteed, not theoretical.
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

        const approvalResult = await graph.query(
            queryQl(
                createGraphType('branchApprovals', `staleAt documentsStale`)('approvals'),
                {
                    where: {
                        branchId: { _eq: branchId },
                        dateFor: { _eq: dateFor },
                    },
                },
            ),
        );
        const staleAt = approvalResult?.data?.approvals?.[0]?.documentsStale
            ? approvalResult?.data?.approvals?.[0]?.staleAt
            : null;

        // CHANGED: was a flat array mapped 1:1 from rawDocs (one object per
        // doc_type, implicitly). Now grouped into arrays per doc_type,
        // since multiple files can be simultaneously active for the same
        // type. Frontend consumes `documentsByType[docType]` as an array.
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

        // Sort each type's files by version, most recent first — matters
        // now that a type can have several.
        Object.values(documentsByType).forEach(arr => arr.sort((a, b) => b.version - a.version));

        return res.status(200).json({ success: true, documentsByType });
    } catch (error) {
        console.error('Error listing closing documents:', error.message);
        return res.status(200).json({ success: false, message: 'Error listing closing documents.' });
    }
}