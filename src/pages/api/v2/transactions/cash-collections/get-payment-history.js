import { CASH_COLLECTIONS_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `
  ${CASH_COLLECTIONS_FIELDS}
`)('cashCollections');

export default apiHandler({
    get: getPaymentHistory
});

async function getPaymentHistory(req, res) {
    let statusCode = 200;
    let response = {};

    try {
        const { loanId } = req.query;

        if (!loanId) {
            return res.status(400).json({ 
                success: false, 
                message: 'loanId is required' 
            });
        }

        // Fetch all cash collections for the given loanId, sorted by dateAdded descending (latest first)
        const cashCollections = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    loanId: { _eq: loanId }
                },
                order_by: [{ dateAdded: 'desc' }]
            })
        ).then(res => res.data?.cashCollections ?? []);

        response = {
            success: true,
            data: cashCollections
        };

    } catch (error) {
        console.error('Error fetching payment history:', error);
        statusCode = 500;
        response = {
            success: false,
            message: 'Failed to fetch payment history',
            error: error.message
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}