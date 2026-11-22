// src/lib/duplicate-alerts-access.js  (safe on client and server)
// Who sees the dashboard "Duplicate Alerts" widget and may call clients/duplicates/alerts.
// For now: system admins (root / rep 1) and division heads (deputy_director). The server scopes a division head
// to the branches of their division (resolveLoanBranchScope), so no extra filtering is needed here.
// To open it to regional managers later, add 'regional_manager' below — the scoping already handles that role.
export const DUPLICATE_ALERT_ROLES = ['admin', 'deputy_director'];

export function canSeeDuplicateAlerts(user) {
    if (!user) return false;
    if (user.root === true || user.role?.rep === 1) return true;
    return DUPLICATE_ALERT_ROLES.includes(user.role?.shortCode ?? user.shortCode);
}
