// src/lib/ci-roles.js
// Pure helpers (no server imports): API routes AND client components share one definition.
// Identity is by role.shortCode (same as Nav.js / loan-application-v2-gate.js).

export const getShortCode = (user) => user?.role?.shortCode ?? user?.shortCode ?? null;

export const isSystemAdmin = (user) =>
    user?.root === true || getShortCode(user) === 'admin';

// Who may approve/reject a CI. The same set also claims, promotes, reverts, validates
// duplicates and adds the loan from the CI banner.
export const CI_DECISION_ROLES = [
    'admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager',
];

export const canDecideCI = (user) =>
    isSystemAdmin(user) || CI_DECISION_ROLES.includes(getShortCode(user));

// Admin / supervisors: can decide CI but are not branch-level (no designated branch)
export const isAboveBranchLevel = (user) =>
    canDecideCI(user) && getShortCode(user) !== 'branch_manager';