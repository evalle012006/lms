// src/lib/client-scope.js  (server only)
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { resolveBranchWhere, branchWhereAllows } from '@/lib/ci-scope';

const graph = new GraphProvider();
const CLIENT_SCOPE_TYPE = createGraphType('client', '_id branchId')('clients');
const LOAN_SCOPE_TYPE   = createGraphType('loans', '_id branchId status')('loans');

/**
 * { _id, branchId } when the user may act on this client, otherwise null.
 * In scope when the client's own branch is in scope, OR the client has a live
 * (pending/active) loan in a branch that is: balik/transferred clients keep their previous
 * branch until re-assigned. `branchId` is the branch that granted access.
 */
export async function resolveClientInScope(user, clientId) {
    if (!user || typeof clientId !== 'string' || !clientId) return null;

    const [client] = await graph.query(
        queryQl(CLIENT_SCOPE_TYPE, { where: { _id: { _eq: clientId } }, limit: 1 })
    ).then(r => r.data?.clients ?? []);
    if (!client) return null;

    const where = await resolveBranchWhere(user);
    if (branchWhereAllows(where, client.branchId)) {
        return { _id: client._id, branchId: client.branchId };
    }

    const loans = await graph.query(
        queryQl(LOAN_SCOPE_TYPE, {
            where: { clientId: { _eq: clientId }, status: { _in: ['pending', 'active'] } },
            limit: 5,
        })
    ).then(r => r.data?.loans ?? []);

    const live = loans.find(l => branchWhereAllows(where, l.branchId));
    return live ? { _id: client._id, branchId: live.branchId } : null;
}