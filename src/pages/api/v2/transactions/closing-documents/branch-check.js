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
        // distinct_on collapses per-client rows at the database level —
        // one row per unique (loId, groupId) combination, not one per
        // client. Hasura requires order_by on the same leading columns as
        // distinct_on.
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

        // Also selects uploaded_at — needed below to compute whether any
        // currently-active document still predates the last reopen.
        const docs = await graph.query(
            queryQl(
                createGraphType('closing_documents', `doc_type uploaded_at`)('closingDocuments'),
                {
                    where: {
                        branch_id: { _eq: branchId },
                        date_for: { _eq: dateFor },
                        is_active: { _eq: true },
                    },
                },
            ),
        );
        const activeDocs = docs?.data?.closingDocuments || [];
        const uploadedTypes = activeDocs.map(d => d.doc_type);
        const missingDocTypes = CLOSING_DOC_KEYS.filter(k => !uploadedTypes.includes(k));

        // Pull current approval status alongside readiness, so the
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
        // FIXED: this line was missing entirely — everything below it
        // referenced approvalRecord, which was never declared, throwing a
        // ReferenceError caught by the outer try/catch and masked as a
        // generic "Error checking branch closing readiness." with no
        // indication of the real cause.
        const approvalRecord = approval?.data?.approvals?.[0] || null;

        // documentsStale (the raw DB flag) only ever gets cleared by AM's
        // next finalize — it does NOT reflect whether BM has already fixed
        // things. This computes the question the BM button actually needs
        // answered: "is there still at least one file that predates the
        // reopen," using the same predatesReopen comparison list.js already
        // does per file, aggregated here. Once every file has been
        // replaced, this correctly flips to false even while documentsStale
        // stays true as a permanent audit record.
        const documentsNeedReupload = !!(
            approvalRecord?.documentsStale &&
            approvalRecord?.staleAt &&
            activeDocs.some(d => new Date(d.uploaded_at) < new Date(approvalRecord.staleAt))
        );

        return res.status(200).json({
            success: true,
            allLosClosed,
            unclosedLos,
            missingDocTypes,
            readyToUpload: allLosClosed,
            readyToClose: allLosClosed && missingDocTypes.length === 0,
            approvalStatus: approvalRecord?.status || null,
            documentsStale: approvalRecord?.documentsStale || false,
            documentsNeedReupload,
            staleReason: approvalRecord?.staleReason || null,
            staleAt: approvalRecord?.staleAt || null,
        });
    } catch (error) {
        console.error('Error checking branch closing readiness:', error.message);
        return res.status(200).json({ success: false, message: 'Error checking branch closing readiness.' });
    }
}