// src/pages/api/v2/transactions/closing-documents/branch-check.js

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { CLOSING_DOC_KEYS } from '@/lib/closing-documents.constants';

const graph = new GraphProvider();

export default apiHandler({
    get: branchCheck,
});

async function branchCheck(req, res) {
    const { branchId, dateFor } = req.query;

    if (!branchId || !dateFor) {
        return res.status(200).json({ success: false, message: 'branchId and dateFor are required.' });
    }

    try {
        // CHANGED (again): limit:1 threw away real information — loId and
        // groupId are genuinely useful (e.g. for a future "which LO is
        // still open" message), the actual problem was never those fields,
        // it was that this table is per-CLIENT, so the same loId/groupId
        // pair repeated once per active client instead of once per LO.
        // distinct_on collapses that at the database level — one row per
        // unique (loId, groupId) combination, not one per client. Hasura
        // requires order_by on the same leading columns as distinct_on.
        const unclosed = await graph.query(
            queryQl(
                createGraphType('cashCollections', `loId groupId`)('cashCollections'),
                {
                    where: {
                        branchId: { _eq: branchId },
                        dateAdded: { _eq: dateFor },
                        groupStatus: { _neq: 'closed' },
                    },
                    distinct_on: ['loId', 'groupId'],
                    order_by: [{ loId: 'asc' }, { groupId: 'asc' }],
                },
            ),
        );

        const unclosedLos = unclosed?.data?.cashCollections || [];
        const allLosClosed = unclosedLos.length === 0;

        const docs = await graph.query(
            queryQl(
                createGraphType('closing_documents', `doc_type`)('closingDocuments'),
                {
                    where: {
                        branch_id: { _eq: branchId },
                        date_for: { _eq: dateFor },
                        is_active: { _eq: true },
                    },
                },
            ),
        );

        const uploadedTypes = (docs?.data?.closingDocuments || []).map(d => d.doc_type);
        const missingDocTypes = CLOSING_DOC_KEYS.filter(k => !uploadedTypes.includes(k));

        // ADDED: pull current approval status alongside readiness, so the
        // frontend doesn't need a second call to branches/get-approval-status
        // just to answer "is this branch already closed / is it stale."
        // branchApprovals is camelCase (legacy Mongo-migrated table) — do not
        // "fix" this to snake_case if touching this file again.
        const approval = await graph.query(
            queryQl(
                createGraphType('branchApprovals', `status documentsStale staleReason staleAt`)('approvals'),
                {
                    where: {
                        branchId: { _eq: branchId },
                        dateFor: { _eq: dateFor },
                    },
                },
            ),
        );
        const approvalRecord = approval?.data?.approvals?.[0] || null;

        return res.status(200).json({
            success: true,
            allLosClosed,
            unclosedLos,
            missingDocTypes,
            readyToUpload: allLosClosed,
            readyToClose: allLosClosed && missingDocTypes.length === 0,
            approvalStatus: approvalRecord?.status || null,
            documentsStale: approvalRecord?.documentsStale || false,
            staleReason: approvalRecord?.staleReason || null,
            staleAt: approvalRecord?.staleAt || null,
        });
    } catch (error) {
        console.error('Error checking branch closing readiness:', error.message);
        return res.status(200).json({ success: false, message: 'Error checking branch closing readiness.' });
    }
}