// src/lib/duplicate-access.js  (safe on client and server)
// Who may open Reports > Duplicate Clients, and what they may do there.
//   'full'     root only: every branch, Re-scan, Merge, Confirm / Not a duplicate / Not same person.
//   'readonly' every other admin (rep 1, sees all branches) and branch manager, area manager, regional manager,
//              division head (own branches only): view, filter, compare profiles, statistics and Excel export;
//              no Re-scan and no action buttons. The server enforces both the scope and the action gates
//              (resolveDuplicateScope / canManageDuplicates); hiding buttons is a convenience, not the protection.
//   null       everybody else (loan officers etc.).
export const READONLY_ROLES = ['admin', 'branch_manager', 'area_admin', 'regional_manager', 'deputy_director'];

export function duplicateAccess(user) {
    if (!user) return null;
    if (user.root === true) return 'full';
    if (user.role?.rep === 1) return 'readonly';
    return READONLY_ROLES.includes(user.role?.shortCode ?? user.shortCode) ? 'readonly' : null;
}

export const canManageDuplicates = (user) => duplicateAccess(user) === 'full';
