import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const LOAN_TYPE = createGraphType('loans', `
    _id disbursementPhotoKey disbursementPhotoAt
`)('loans');

export default apiHandler({ post: saveDisbursementPhoto });

async function saveDisbursementPhoto(req, res) {
    const { loanId, disbursementPhotoKey } = req.body;

    if (!loanId || !disbursementPhotoKey) {
        return res.status(200).json({
            success: false,
            message: 'loanId and disbursementPhotoKey are required.',
        });
    }

    await graph.mutation(
        updateQl(LOAN_TYPE, {
            set: {
                disbursementPhotoKey,
                disbursementPhotoAt: new Date().toISOString(),
            },
            where: { _id: { _eq: loanId } },
        })
    );

    res.status(200).json({ success: true });
}