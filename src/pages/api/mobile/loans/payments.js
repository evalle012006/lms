import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { PAYMENT_MOBILE_FIELDS } from '@/lib/mobile-graph.fields';

const graph = new GraphProvider();

const LOAN_OWNER_TYPE = createGraphType('loans', `_id clientId`)('loans');

const PAYMENT_TYPE = createGraphType('cashCollections', `
  ${PAYMENT_MOBILE_FIELDS}
`)('cashCollections');

export default clientApiHandler({
    get: getPaymentHistory
});

async function getPaymentHistory(req, res) {
    try {
        const { clientId } = req.auth;
        const { loanId } = req.query;

        if (!loanId) {
            return res.status(400).json({ success: false, message: 'loanId is required' });
        }

        // Ownership check — this is the step the staff-facing
        // get-payment-history.js endpoint skips (it trusts loanId as-is,
        // which is fine when only staff can call it, not fine here).
        const [loan] = await graph.query(
            queryQl(LOAN_OWNER_TYPE, { where: { _id: { _eq: loanId } } })
        ).then(r => r.data?.loans ?? []);

        if (!loan || loan.clientId !== clientId) {
            // Same response whether the loan doesn't exist or belongs to
            // someone else — don't let the error message confirm which
            // loan ids exist to a caller probing them.
            return res.status(404).json({ success: false, message: 'Loan not found' });
        }

        const payments = await graph.query(
            queryQl(PAYMENT_TYPE, {
                where: { loanId: { _eq: loanId } },
                order_by: [{ dateAdded: 'desc' }],
            })
        ).then(r => r.data?.cashCollections ?? []);

        return res.status(200).json({ success: true, data: payments });

    } catch (error) {
        console.error('mobile payment history error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load payment history' });
    }
}