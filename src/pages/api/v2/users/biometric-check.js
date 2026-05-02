// Public endpoint — no auth required
// Called from login page before user is authenticated
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `
    _id biometricCredentialId
`)('users');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { email } = req.query;

    if (!email) {
        return res.status(200).json({ success: false, hasBiometric: false });
    }

    try {
        const [user] = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    email:  { _eq: email },
                    status: { _eq: 'active' },
                }
            })
        ).then(r => r.data?.users ?? []);

        return res.status(200).json({
            success:      true,
            hasBiometric: !!(user?.biometricCredentialId),
            userId:       user?._id || null,
        });
    } catch (err) {
        return res.status(200).json({ success: false, hasBiometric: false });
    }
}