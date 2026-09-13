// src/lib/api/resolveClientBranchScope.js
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { BRANCH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', BRANCH_FIELDS)('branches');

// Shared by list-active-paginated.js and list-prospect-paginated.js.
// list-offset-paginated.js does NOT use this yet — it has its own, simpler,
// non-role-scoped branchId handling. That's a pre-existing gap, flagged but
// intentionally not touched here — out of scope for this change.
export async function resolveClientBranchScope(currentUser) {
    if (currentUser.root) {
        return { branchIds: null, branches: null };
    }

    const { role } = currentUser;

    if (role.rep === 3 || role.rep === 4) {
        if (!currentUser.designatedBranchId) {
            return { branchIds: [], branches: [] };
        }
        const [branch] = await graph.query(
            queryQl(BRANCH_TYPE, { where: { _id: { _eq: currentUser.designatedBranchId } } })
        ).then(r => r.data?.branches ?? []);
        return branch
            ? { branchIds: [branch._id], branches: [branch] }
            : { branchIds: [], branches: [] };
    }

    const _and = [];
    if (currentUser.divisionId) _and.push({ divisionId: { _eq: currentUser.divisionId } });
    if (currentUser.regionId)   _and.push({ regionId:   { _eq: currentUser.regionId } });
    if (currentUser.areaId)     _and.push({ areaId:     { _eq: currentUser.areaId } });

    if (!_and.length) return { branchIds: [], branches: [] };

    const branches = await graph.query(
        queryQl(BRANCH_TYPE, { where: { _and }, order_by: [{ code: 'asc' }] })
    ).then(r => r.data?.branches ?? []);

    return { branchIds: branches.map(b => b._id), branches };
}