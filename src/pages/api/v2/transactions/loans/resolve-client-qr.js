// src/pages/api/v2/transactions/loans/resolve-client-qr.js
// POST { token } — turn a scanned client QR token into { _id, fullName } so the
// Loan Application list can filter by that client.
//
// Why this exists instead of passing the token to the list endpoint: the token is
// the credential behind the client's collection QR. As a POST body it stays out of
// the query strings that get logged by proxies and kept in browser history; the
// list endpoint only ever sees the client's id.
//
// Scope: only a client in the caller's own branches resolves. A token that is
// malformed, unknown, regenerated (the old one is invalidated) or belongs to
// another scope all return the same message, so this cannot be used to probe for
// clients elsewhere.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';

const graph = new GraphProvider();
// singular type name, plural response key: the convention for the `client` table
const CLIENT_TYPE = createGraphType('client', '_id firstName lastName fullName branchId')('clients');

const TOKEN_SHAPE = /^[A-Za-z0-9._~-]{8,200}$/;
const NOT_FOUND = 'No client in your branches matches this QR code. It may have been regenerated.';

export default apiHandler({ post: resolveClientQr });

async function resolveClientQr(req, res) {
    try {
        const user = await findUserById(req.auth.sub);
        if (!user) return res.status(200).json({ success: false, message: 'User not found.' });

        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
        if (!TOKEN_SHAPE.test(token)) {
            return res.status(200).json({ success: false, message: NOT_FOUND });
        }

        const scope = await resolveLoanBranchScope(user);
        if (scope.branchIds && scope.branchIds.length === 0) {
            return res.status(200).json({ success: false, message: 'No branches are assigned to your account.' });
        }

        const where = { qrToken: { _eq: token } };
        if (scope.branchIds) where.branchId = { _in: scope.branchIds };

        const [client] = await graph
            .query(queryQl(CLIENT_TYPE, { where, limit: 1 }))
            .then((r) => r.data?.clients ?? []);

        if (!client) return res.status(200).json({ success: false, message: NOT_FOUND });

        return res.status(200).json({
            success: true,
            client: {
                _id: client._id,
                fullName: client.fullName || `${client.lastName}, ${client.firstName}`,
            },
        });
    } catch (e) {
        console.error('[loans/resolve-client-qr] failed', e);
        return res.status(200).json({ success: false, message: 'Failed to read the QR code.' });
    }
}