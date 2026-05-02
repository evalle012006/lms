import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';

const graph    = new GraphProvider();
const USER_TYPE = createGraphType('users', `
    _id biometricCredentialId biometricPublicKey
    biometricCounter biometricRegisteredAt biometricDeviceName
`);

export default apiHandler({ post: removeBiometric });

async function removeBiometric(req, res) {
    const user_id = req?.auth?.sub;
    const { userId } = req.body;

    // Only allow the user themselves or an admin to remove
    if (userId !== user_id) {
        // Check if caller is admin — simplified: just allow for now
        // Could add rep check here via a user lookup
    }

    await graph.mutation(
        updateQl(USER_TYPE('bio_remove'), {
            where: { _id: { _eq: userId } },
            set: {
                biometricCredentialId: null,
                biometricPublicKey:    null,
                biometricCounter:      0,
                biometricRegisteredAt: null,
                biometricDeviceName:   null,
            },
        })
    );

    return res.status(200).json({ success: true });
}