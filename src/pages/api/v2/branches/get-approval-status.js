import { CLOSING_DOC_KEYS } from '@/lib/closing-documents.constants';
import { BRANCH_APPROVAL_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

let response = {};
let statusCode = 200;

const graph = new GraphProvider();

export default apiHandler({
    post: getBranchApprovalStatus
});

async function getBranchApprovalStatus(req, res) {
    const { branchIds, dateFor } = req.body;

    if (!branchIds || !Array.isArray(branchIds) || branchIds.length === 0) {
        response = { error: true, message: "Branch IDs array is required." };
        statusCode = 400;
    } else if (!dateFor) {
        response = { error: true, message: "Date is required." };
        statusCode = 400;
    } else {
        try {
            const approvals = await graph.query(
                queryQl(
                    createGraphType('branchApprovals', `${BRANCH_APPROVAL_FIELDS}`)('approvals'),
                    {
                        where: {
                            branchId: { _in: branchIds },
                            dateFor: { _eq: dateFor }
                        }
                    }
                )
            );

            const closingDocs = await graph.query(
                queryQl(
                    createGraphType('closing_documents', `branch_id doc_type`)('closingDocuments'),
                    {
                        where: {
                            branch_id: { _in: branchIds },
                            date_for: { _eq: dateFor },
                            is_active: { _eq: true }
                        }
                    }
                )
            );

            const docTypesByBranch = {};
            (closingDocs?.data?.closingDocuments || []).forEach(d => {
                if (!docTypesByBranch[d.branch_id]) docTypesByBranch[d.branch_id] = new Set();
                docTypesByBranch[d.branch_id].add(d.doc_type);
            });

            const closingDocsCounts = {};
            Object.keys(docTypesByBranch).forEach(branchId => {
                closingDocsCounts[branchId] = docTypesByBranch[branchId].size;
            });

            response = {
                success: true,
                data: approvals?.data?.approvals || [],
                closingDocsCounts,              // { [branchId]: distinct doc_type count }
                requiredClosingDocsCount: CLOSING_DOC_KEYS.length
            };
        } catch (error) {
            console.error('Error fetching branch approval status:', error);
            response = { error: true, message: "Error fetching approval status." };
            statusCode = 500;
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}