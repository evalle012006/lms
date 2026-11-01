// src/lib/offline-upload/permissions.js
// Pure helpers (no server imports): API routes AND client components share one definition.
// Server-side enforcement is the source of truth. The client only uses these to show or hide buttons.

// A designatedBranchId / loanOfficerId can be stored as " " (a space), so never use bare truthiness.
const hasId = (v) => typeof v === 'string' && v.trim().length > 0;

// root / admin (rep 1): any group. Branch manager (3): own branch. Loan officer (4): own groups.
// Area managers (rep 2) are view-only on the LOR pages today, so they are excluded.
export const canUseOfflineUpload = (user) =>
    !!(user && (user.root === true || [1, 3, 4].includes(user?.role?.rep)));

// Phase 2 (backdating) only. Not used by v1, which always posts to the system date.
export const canChooseOfflineDate = (user) =>
    !!(user && (user.root === true || user?.role?.rep === 1));

export const canAccessGroupForUpload = (user, group) => {
    if (!user || !group) return false;
    if (user.root === true || user?.role?.rep === 1) return true;
    if (user?.role?.rep === 3) return hasId(user.designatedBranchId) && group.branchId === user.designatedBranchId;
    if (user?.role?.rep === 4) return hasId(user._id) && group.loanOfficerId === user._id;
    return false;
};