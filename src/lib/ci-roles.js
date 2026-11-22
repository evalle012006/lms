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

// ── Loan officer access ─────────────────────────────────────────────────────
// LOs can always VIEW (and print the LAF of) CIs for their own groups, read-only.
// They can submit an investigation only while the system setting allowLoCI is on.
export const isLoanOfficer = (user) =>
    user?.root !== true && getShortCode(user) === 'loan_officer';

export const canViewCI = (user) => canDecideCI(user) || isLoanOfficer(user);

// allowLoCI comes from system settings (client: redux, server: settings table).
export const canInvestigateCI = (user, allowLoCI) =>
    canDecideCI(user) || (isLoanOfficer(user) && allowLoCI === true);
