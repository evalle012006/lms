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
            // Query branchApprovals table for the given branches and date
            // Using BRANCH_APPROVAL_FIELDS constant for consistency
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

            if (approvals && approvals.data && approvals.data.approvals) {
                response = { 
                    success: true, 
                    data: approvals.data.approvals 
                };
            } else {
                response = { 
                    success: true, 
                    data: [] 
                };
            }
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