// src/lib/ci-scope.js  (server only)
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';
import { getShortCode, isSystemAdmin, CI_DECISION_ROLES, canDecideCI } from '@/lib/ci-roles';

export { getShortCode, isSystemAdmin, CI_DECISION_ROLES, canDecideCI };
export const canPromoteCI = canDecideCI;
export const canClaimCI   = canDecideCI;

/**
 * {}                         -> unscoped (root / admin)
 * { branchId: { _in: [..] } } -> scoped; an empty list matches zero rows
 * null                       -> deny (no user)
 * Delegates to resolveLoanBranchScope so CI and loan-approval visibility always agree.
 */
export async function resolveBranchWhere(user) {
    if (!user) return null;
    const { branchIds } = await resolveLoanBranchScope(user);
    if (branchIds === null) return {};
    return { branchId: { _in: branchIds } };
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