// src/lib/ci-scope.js  (server only)
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { GraphProvider } from '@/lib/graph/graph.provider';
import {
    getShortCode, isSystemAdmin, CI_DECISION_ROLES, canDecideCI,
    isLoanOfficer, canViewCI, canInvestigateCI,
} from '@/lib/ci-roles';

export { getShortCode, isSystemAdmin, CI_DECISION_ROLES, canDecideCI, isLoanOfficer, canViewCI, canInvestigateCI };
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

// ── Loan officer scope: only groups under the LO ────────────────────────────
const _graph = new GraphProvider();
const _GROUP_IDS_TYPE = createGraphType('groups', '_id')('groups');
const _SETTINGS_TYPE  = createGraphType('settings', 'allowLoCI')('settings');

/** System setting: may loan officers submit a CI investigation? Fails closed. */
export async function getAllowLoCI() {
    try {
        const [s] = await _graph
            .query(queryQl(_SETTINGS_TYPE, { limit: 1 }))
            .then(r => r.data?.settings ?? []);
        return s?.allowLoCI === true;
    } catch {
        return false;
    }
}

/**
 * Branch scope plus, for a loan officer, the groups they own.
 *   null -> deny
 * An LO with no groups matches zero rows (empty _in), never everything.
 */
export async function resolveCIWhere(user) {
    const branchWhere = await resolveBranchWhere(user);
    if (branchWhere === null) return null;
    if (!isLoanOfficer(user)) return branchWhere;
    const groups = await _graph
        .query(queryQl(_GROUP_IDS_TYPE, { where: { loanOfficerId: { _eq: user._id } } }))
        .then(r => r.data?.groups ?? []);
    return { ...branchWhere, groupId: { _in: groups.map(g => g._id) } };
}

/** Pure check of one application against an already-resolved CI where. */
export function ciWhereAllows(where, application) {
    if (!where || !application) return false;
    if (!branchWhereAllows(where, application.branchId)) return false;
    if (where.groupId?._in) return where.groupId._in.includes(application.groupId);
    return true;
}

/** Single-record check (detail / decision endpoints). */
export async function isApplicationInScope(user, application) {
    return ciWhereAllows(await resolveCIWhere(user), application);
}
