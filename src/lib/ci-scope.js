// src/lib/ci-scope.js
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');

// Who may approve / reject a CI. System admins always pass via isSystemAdmin().
export const CI_DECISION_ROLES = ['admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager'];

export const getShortCode = (user) => user?.role?.shortCode ?? user?.shortCode ?? null;

export const isSystemAdmin = (user) =>
    user?.root === true || user?.role?.rep === 1 || getShortCode(user) === 'admin';

export const canDecideCI = (user) =>
    isSystemAdmin(user) || CI_DECISION_ROLES.includes(getShortCode(user));

// Same roles as approve/reject for now. Separate exports so they can diverge.
export const canPromoteCI = canDecideCI;
export const canClaimCI   = canDecideCI;

function buildBranchWhereForRep2({ shortCode, areaId, regionId, divisionId }) {
    if (shortCode === 'area_admin'       && areaId)     return { areaId:     { _eq: areaId } };
    if (shortCode === 'regional_manager' && regionId)   return { regionId:   { _eq: regionId } };
    if (shortCode === 'deputy_director'  && divisionId) return { divisionId: { _eq: divisionId } };
    return null; // unknown shortCode or missing id => deny
}

/**
 * {}           -> unscoped (system admin only)
 * { branchId } -> scoped where clause
 * null         -> deny
 */
export async function resolveBranchWhere(user) {
    if (isSystemAdmin(user)) return {};
    const rep = user?.role?.rep;

    if (rep === 3 || rep === 4) {
        if (!user.designatedBranchId) return null;
        return { branchId: { _eq: user.designatedBranchId } };
    }

    if (rep === 2) {
        const filter = buildBranchWhereForRep2({ ...user, shortCode: getShortCode(user) });
        if (!filter) return null;
        const branches = await graph
            .query(queryQl(BRANCH_TYPE, { where: filter }))
            .then(r => r.data?.branches ?? []);
        return { branchId: { _in: branches.map(b => b._id) } }; // empty list = zero rows
    }

    return null;
}

/** Pure check against an already-resolved where. Use inside loops / bulk endpoints. */
export function branchWhereAllows(where, branchId) {
    if (where === null || where === undefined) return false;
    if (!where.branchId) return true; // unscoped
    if (where.branchId._eq !== undefined) return where.branchId._eq === branchId;
    if (Array.isArray(where.branchId._in)) return where.branchId._in.includes(branchId);
    return false;
}

/** Single-record check (detail / decision endpoints). */
export async function isBranchInScope(user, branchId) {
    return branchWhereAllows(await resolveBranchWhere(user), branchId);
}