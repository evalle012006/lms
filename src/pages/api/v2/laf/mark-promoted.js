import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default apiHandler({ post: markPromoted });

async function markPromoted(req, res) {
    const { ciReferenceCode, clientId } = req.body;

    await graph.mutation(
        updateQl(TEMP_TYPE, {
            set: {
                status: 'promoted',
                promotedClientId: clientId,
            },
            where: { ciReferenceCode: { _eq: ciReferenceCode } }
        })
    );

    res.status(200).json({ success: true });
}