import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const LOAN_TYPE = createGraphType('loans', `
    _id clientBiometricVerified clientBiometricVerifiedAt
`)('loans');

export default apiHandler({ get: checkStatus });

async function checkStatus(req, res) {
    const { loanId } = req.query;
    if (!loanId) return res.status(200).json({ success: false, message: 'loanId required' });

    const [loan] = await graph.query(
        queryQl(LOAN_TYPE, { where: { _id: { _eq: loanId } } })
    ).then(r => r.data?.loans ?? []);

    return res.status(200).json({
        success:  true,
        verified: loan?.clientBiometricVerified || false,
        verifiedAt: loan?.clientBiometricVerifiedAt || null,
    });
}