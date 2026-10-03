import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { LOAN_MOBILE_FIELDS } from '@/lib/mobile-graph.fields';

const graph = new GraphProvider();

const LOAN_TYPE = createGraphType('loans', `
  ${LOAN_MOBILE_FIELDS}
`)('loans');

export default clientApiHandler({
    get: listLoans
});

async function listLoans(req, res) {
    try {
        const { clientId } = req.auth;

        const loans = await graph.query(
            queryQl(LOAN_TYPE, {
                where: { clientId: { _eq: clientId } },
                order_by: [{ dateGranted: 'desc' }],
            })
        ).then(r => r.data?.loans ?? []);

        // Active loan first, then most recently modified, then highest
        // loanCycle as a final tiebreak — sorted here in JS rather than via
        // a more complex Hasura order_by, since a client's own loan count
        // is always small.
        const sorted = [...loans].sort((a, b) => {
            const aActive = a.status === 'active' ? 1 : 0;
            const bActive = b.status === 'active' ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;

            const aModified = a.dateModified ? new Date(a.dateModified).getTime() : 0;
            const bModified = b.dateModified ? new Date(b.dateModified).getTime() : 0;
            if (aModified !== bModified) return bModified - aModified;

            return (b.loanCycle ?? 0) - (a.loanCycle ?? 0);
        });

        return res.status(200).json({ success: true, data: sorted });

    } catch (error) {
        console.error('mobile loans list error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load loans' });
    }
}