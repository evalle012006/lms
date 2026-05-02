import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { BRANCH_FIELDS } from '@/lib/graph.fields';
import crypto from 'crypto';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', BRANCH_FIELDS)('branches');

export default apiHandler({ post: generateQR });

async function generateQR(req, res) {
    const { branchId } = req.body;

    const [branch] = await graph.query(
        queryQl(BRANCH_TYPE, { where: { _id: { _eq: branchId } } })
    ).then(r => r.data.branches);

    if (!branch) {
        return res.status(200).json({ success: false, message: 'Branch not found.' });
    }

    const qrToken = crypto.randomBytes(16).toString('hex');
    const publicUrl = `${process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN}/apply/${qrToken}`;

    await graph.mutation(
        updateQl(BRANCH_TYPE, {
            set: { qrToken, qrGeneratedAt: new Date().toISOString() },
            where: { _id: { _eq: branchId } }
        })
    );

    res.status(200).json({ success: true, qrToken, publicUrl, branchName: branch.name });
}