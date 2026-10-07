// src/lib/api/resolveLoanBranchScope.js
// Branch scoping for the v2 loan-application endpoints.
//
// Why this is NOT resolveClientBranchScope:
//   - That helper treats every non-root rep=1 user as "no division/region/area"
//     and returns an empty scope, so a non-root `admin` would see nothing.
//   - It AND-combines division/region/area, whereas every existing loan endpoint
//     (loans/list.js, loans/list-history.js, bad-debts list) scopes by the
//     role's shortCode with a single key. Keeping loan scoping identical to the
//     classic page avoids a visibility mismatch between the two pages.
//
// Contract (same shape as resolveClientBranchScope so callers/UI can share logic):
//   { branchIds: null,  branches: null }   -> all branches (root / admin)
//   { branchIds: [...], branches: [...] }  -> restricted to these branches
//   { branchIds: [],    branches: [] }     -> no access (fails CLOSED)
//
// Unlike loans/list.js, a supervisor whose role has no matching area/region/
// division id gets NOTHING here instead of an unscoped (or crashing) query.

import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { BRANCH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', BRANCH_FIELDS)('branches');

// designatedBranchId is sometimes stored as " " (a space) instead of null.
const hasId = (v) => typeof v === 'string' && v.trim().length > 0;

export async function resolveLoanBranchScope(currentUser) {
    const role = currentUser?.role;

    if (currentUser?.root === true || role?.rep === 1 || role?.shortCode === 'admin') {
        return { branchIds: null, branches: null };
    }

    let where = null;

    if (role?.rep === 3 || role?.rep === 4) {
        if (hasId(currentUser.designatedBranchId)) {
            where = { _id: { _eq: currentUser.designatedBranchId } };
        }
    } else if (role?.shortCode === 'area_admin' && hasId(currentUser.areaId)) {
        where = { areaId: { _eq: currentUser.areaId } };
    } else if (role?.shortCode === 'regional_manager' && hasId(currentUser.regionId)) {
        where = { regionId: { _eq: currentUser.regionId } };
    } else if (role?.shortCode === 'deputy_director' && hasId(currentUser.divisionId)) {
        where = { divisionId: { _eq: currentUser.divisionId } };
    }

    if (!where) return { branchIds: [], branches: [] };

    const branches = await graph
        .query(queryQl(BRANCH_TYPE, { where, order_by: [{ code: 'asc' }] }))
        .then((r) => r.data?.branches ?? []);

    return { branchIds: branches.map((b) => b._id), branches };
}