import moment from 'moment';

import { clientApiHandler } from '@/services/client-api-handler';
import { hashToken, refreshTokenGraph, REFRESH_TOKEN_TYPE } from '@/services/refresh-token-service';
import { updateQl } from '@/lib/graph/graph.util';

export default clientApiHandler({
    post: logout
});

async function logout(req, res) {
    try {
        const { refreshToken } = req.body;

        // No refreshToken given — nothing server-side to revoke (e.g. the app
        // lost it already). Still return success: the client will clear its
        // local token regardless, and this must never block sign-out.
        if (!refreshToken) {
            return res.status(200).json({ success: true });
        }

        await refreshTokenGraph.mutation(
            updateQl(REFRESH_TOKEN_TYPE, {
                set: { revoked_at: moment().toISOString() },
                where: { token_hash: { _eq: hashToken(refreshToken) }, revoked_at: { _is_null: true } }
            })
        );

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('logout error:', error);
        // Same reasoning as above — a logging/DB hiccup here shouldn't trap
        // the user in a signed-in state they're trying to leave.
        return res.status(200).json({ success: true });
    }
}