import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { WITHDRAWAL_MOBILE_FIELDS } from '@/lib/mobile-graph.fields';

const graph = new GraphProvider();

const WITHDRAWAL_TYPE = createGraphType('mcbu_withdrawals', `
  ${WITHDRAWAL_MOBILE_FIELDS}
`)('mcbu_withdrawals');

export default clientApiHandler({
    get: listWithdrawals
});

async function listWithdrawals(req, res) {
    try {
        const { clientId } = req.auth;

        const withdrawals = await graph.query(
            queryQl(WITHDRAWAL_TYPE, {
                where: { client_id: { _eq: clientId } },
                order_by: [{ inserted_date: 'desc' }],
            })
        ).then(r => r.data?.mcbu_withdrawals ?? []);

        return res.status(200).json({ success: true, data: withdrawals });

    } catch (error) {
        console.error('mobile withdrawals list error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load withdrawals' });
    }
}