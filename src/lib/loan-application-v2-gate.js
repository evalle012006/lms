// src/lib/loan-application-v2-gate.js
// Single source of truth for who gets the new Loan Application page.
// Imported by BOTH the page (redirect guard) and Nav.js (menu visibility), so
// widening the rollout is a one-line change here — same idea as
// isEligibleForNewClientExperience() on the client list.
//
// IMPORTANT: never leave this array empty. In Nav.js an empty `roles` array
// means "visible to everyone" (isItemVisibleForRole short-circuits to true),
// so an empty list would silently expose the menu item to all roles.
//
// Roles that can open the new page: every role that has "Loan Approval" in the
// classic navigation (supervisors and branch managers under Transactions, loan
// officers under Daily / Weekly Transactions), plus root. Roles outside this list
// (cashier, finance, ...) never had the classic page either.
//
// What each role can DO is decided separately:
//   list / filters / view LAF / add / edit / disclosure ... see the page's `actions`
//   approvals                                          ... approvalMode() below
export const LOAN_APPLICATION_V2_ROLES = [
    'admin',
    'deputy_director',
    'regional_manager',
    'area_admin',
    'branch_manager',
    'loan_officer',
];

// ONE url serves both versions. /transactions/loan-applications renders either the
// classic page or the new one depending on the user's choice (see
// useLoanApplicationView), so the navigation has a single "Loan Approval" entry and
// every link — nav, add/edit "back", dashboards — keeps pointing at the same place.
export const LOAN_APPLICATION_HOME_PATH = '/transactions/loan-applications';
export const LOAN_APPLICATION_CLASSIC_PATH = LOAN_APPLICATION_HOME_PATH; // kept for older imports
// Old bookmark: redirects to the home path and selects the new version.
export const LOAN_APPLICATION_V2_PATH = '/transactions/loan-applications/v2';

// Which version eligible users see until they choose for themselves.
// Cutover: flip this to 'v2'. Everyone then lands on the new page, with a button to
// go back to classic, and anyone who already picked a version keeps their pick.
export const LOAN_APPLICATION_DEFAULT_VIEW = 'classic'; // 'classic' | 'v2'

// Existing sub-routes the classic page already navigates to. They are separate
// pages, so the list page can link to them without touching them.
export const LOAN_APPLICATION_ADD_PATH = '/transactions/loan-applications/add';
export const loanApplicationEditPath = (id) => `/transactions/loan-applications/edit/${id}`;
export const loanApplicationDisclosurePath = (id) => `/transactions/loan-applications/${id}`;

// Who can approve from the new page, and how:
//   'branch_manager' — own branch only; may also reject; v2 branches go through
//                      the disbursement photo step.
//   'supervisor'     — admin / deputy_director / regional_manager / area_admin
//                      (and root), across the branches in their scope. LDF approve
//                      and final approve on branches that do not require the
//                      disbursement photo; no reject.
// Used by the page (what to show) AND the approval endpoints (what to allow).
export const SUPERVISOR_APPROVER_ROLES = ['admin', 'deputy_director', 'regional_manager', 'area_admin'];

export function approvalMode(user) {
    if (!user) return null;
    if (user.role?.rep === 3) return 'branch_manager';
    if (user.root === true || SUPERVISOR_APPROVER_ROLES.includes(user.role?.shortCode)) return 'supervisor';
    return null;
}

export function isEligibleForLoanApplicationV2(currentUser) {
    if (!currentUser) return false;
    if (currentUser.root === true) return true;
    return LOAN_APPLICATION_V2_ROLES.includes(currentUser.role?.shortCode);
}

/**
 * Where "back to the list" goes. Both versions live at the same url now, so this
 * is always the home path; the argument is kept so the add / edit pages that
 * already call loanApplicationHomePath(currentUser) keep working unchanged.
 */
// eslint-disable-next-line no-unused-vars
export function loanApplicationHomePath(currentUser) {
    return LOAN_APPLICATION_HOME_PATH;
}