// src/lib/roles.js
// ONE place that knows what a user's role looks like. Pure (no server imports): UI, API routes and tests share it.
//
// Storage is unchanged: users.role is a jsonb copy of a `roles` row { _id, name, order, shortCode, system, rep, dateAdded }.
// What this module adds is a tolerant reader + the identity rules:
//   * identity = shortCode (rep is a LEVEL, not an id: rep 2 covers 3 roles, rep 1 covers admin + support)
//   * a role may arrive as an object OR a JSON string (older UI paths stringify it) — always go through getRole()
// Anything that needs "is this user admin-like" must use isSystemAdmin()/isAdminLevel(), never `rep === 1` or
// `shortCode === 'admin'` inline, so a new role is a one-line change here.

export const ROLE = Object.freeze({
    ADMIN: 'admin',
    SUPPORT: 'support',
    DEPUTY_DIRECTOR: 'deputy_director',
    REGIONAL_MANAGER: 'regional_manager',
    AREA_ADMIN: 'area_admin',
    BRANCH_MANAGER: 'branch_manager',
    CASHIER: 'cashier',
    FINANCE: 'finance',
    LOAN_OFFICER: 'loan_officer',
});

/** object | JSON string | null  ->  plain object | null. Never throws. */
export function parseRole(role) {
    if (role === null || role === undefined || role === '') return null;
    if (typeof role === 'object') return Array.isArray(role) ? null : role;
    if (typeof role === 'string') {
        try {
            const parsed = JSON.parse(role);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch { return null; }
    }
    return null;
}

/** Normalised role of a user (or of a bare role): { _id, name, shortCode, rep, system } | null. */
export function getRole(userOrRole) {
    const r = parseRole(userOrRole?.role !== undefined ? userOrRole.role : userOrRole);
    if (!r) return null;
    const rep = r.rep === null || r.rep === undefined || r.rep === '' ? null : Number(r.rep);
    return {
        _id: r._id ?? null,
        name: r.name ?? null,
        shortCode: r.shortCode ?? userOrRole?.shortCode ?? null,
        rep: Number.isFinite(rep) ? rep : null,
        system: r.system ?? null,
    };
}

export const getShortCode = (user) => getRole(user)?.shortCode ?? user?.shortCode ?? null;
export const getRep = (user) => getRole(user)?.rep ?? null;

export const isRoot = (user) => user?.root === true;
export const hasRole = (user, ...shortCodes) => shortCodes.includes(getShortCode(user));
export const isSupport = (user) => hasRole(user, ROLE.SUPPORT);

/** root, administrator or support: the "system level" roles (support mirrors root). */
export const isSystemAdmin = (user) => isRoot(user);

/** Root, rep 1, admin or support (root = false users included). Everything except the root-only settings. */
export const isAdminLevel = (user) => isSystemAdmin(user) || getRep(user) === 1 || hasRole(user, ROLE.ADMIN, ROLE.SUPPORT);

// ── role picker keys ("<rep>-<shortCode>") ───────────────────────────────────────────────────────────────────
export const roleKey = (role) => {
    const r = getRole(role);
    return r ? `${r.rep}-${r.shortCode}` : '';
};

/** Resolve a picker value to the EXACT roles-table row. 'rep-shortCode' matches on shortCode; a bare rep (legacy callers)
 *  falls back to the first role of that level. Returns null when nothing matches — never a hybrid object. */
export function findRoleByKey(roles, key) {
    if (!Array.isArray(roles) || key === null || key === undefined || key === '') return null;
    const text = String(key);
    const i = text.indexOf('-');
    if (i > -1) {
        const shortCode = text.slice(i + 1);
        return roles.find((r) => r.shortCode === shortCode) ?? null;
    }
    return roles.find((r) => Number(r.rep) === Number(text)) ?? null;
}
