/**
 * hris-role-map.js  ->  lms/src/lib/hris-role-map.js
 * --------------------------------------------------
 * Maps HRIS staff.position -> LMS role shortCode.
 *
 * Keys are NORMALIZED (trim, uppercase, collapse spaces) so
 * "Loan Officer" and "LOAN OFFICER" resolve to the same entry.
 *
 * confidence:
 *   'confirmed' = client/business stated this rule
 *   'inferred'  = typo variant or obvious extension, still worth a glance
 *   excluded    = positions deliberately left out of the sync. The sync must
 *                 NOT create or change an LMS user for these.
 *
 * TEMPORARY: once HRIS switches to a constant position dropdown,
 * replace these free-text keys with the dropdown values.
 */

const LO = 'loan_officer';

export const HRIS_POSITION_ROLE_MAP = {
    // ── Confirmed by client ───────────────────────────────────────────────
    'BRANCH MANAGER':            { role: 'branch_manager',  confidence: 'confirmed' },
    'ASSISTANT BRANCH MANAGER':  { role: 'branch_manager',  confidence: 'confirmed' },
    'VICE PRESIDENT':            { role: 'deputy_director', confidence: 'confirmed' },
    'ASSISTANT VICE PRESIDENT':  { role: 'deputy_director', confidence: 'confirmed' },

    // ── Loan officer: spelling variants of the same position ──────────────
    'LOAN OFFICER':                 { role: LO, confidence: 'inferred' },
    'REGULAR LOAN OFFICER':         { role: LO, confidence: 'inferred' },
    'LOAN OFFICER 5':               { role: LO, confidence: 'inferred' },
    'LOAN OFICER':                  { role: LO, confidence: 'inferred' },
    'LOAN OFFECER':                 { role: LO, confidence: 'inferred' },
    'LOAN OFFICE':                  { role: LO, confidence: 'inferred' },
    'LOAN OFFCER':                  { role: LO, confidence: 'inferred' },
    'LOAN OFFICER- PROBATIONARY':   { role: LO, confidence: 'inferred' },
    'PROBATIONARY LOAN OFFICER':    { role: LO, confidence: 'inferred' },
    'PRBATIONARY LOAN OFFICER':     { role: LO, confidence: 'inferred' },
    'PROBATIONAY LOAN OFFICER':     { role: LO, confidence: 'inferred' },
    'PROBITIONARY LOAN OFFICER':    { role: LO, confidence: 'inferred' },

    // ── Inferred by title, confirm with client ────────────────────────────
    'SENIOR VICE PRESIDENT':   { role: 'deputy_director',  confidence: 'inferred' },
    'REGIONAL MANAGER':        { role: 'regional_manager', confidence: 'inferred' },
    'ACTING REGIONAL MANAGER': { role: 'regional_manager', confidence: 'inferred' },
    'AREA MANAGER':            { role: 'area_admin',       confidence: 'inferred' },
    'ACTING AREA MANAGER':     { role: 'area_admin',       confidence: 'inferred' },
    'ACTING BRANCH MANAGER':   { role: 'branch_manager',   confidence: 'inferred' },

    // ── EXCLUDED from sync (client decision) ──────────────────────────────
    // No LMS user is created or changed for these positions.
    'ADMIN PERSONNEL':    { role: null, confidence: null, excluded: true },
    'ADMIN PERSONNEL I':  { role: null, confidence: null, excluded: true },
    'ADMIN PERSONNEL II': { role: null, confidence: null, excluded: true },
};

export const normalizePosition = (p) =>
    String(p ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * @returns {{ role: string|null, confidence: string|null, reason?: string }}
 *   reason = 'excluded' (known, intentionally not synced)
 *          | 'unknown'  (not in map at all -> flag for review, do not sync)
 */
export function resolveLmsRole(hrisPosition) {
    const entry = HRIS_POSITION_ROLE_MAP[normalizePosition(hrisPosition)];
    if (!entry) return { role: null, confidence: null, reason: 'unknown' };
    if (entry.excluded) return { role: null, confidence: null, reason: 'excluded' };
    return entry;
}

/**
 * Roles HRIS is allowed to manage. 'admin', 'cashier' and 'finance' are NEVER
 * linked, vacated, blocked or assigned by HRIS, whatever HRIS says.
 * NOTE: the 2022 roles seed uses shortCode 'regional_admin'; the live system
 * (and lib/coh-permissions.js) uses 'regional_manager'. Confirm on prod.
 */
export const MANAGED_ROLES = ['branch_manager', 'loan_officer', 'deputy_director', 'regional_manager', 'area_admin'];

/** Roles whose seat is tied to one branch (users.designatedBranch, the branch code). */
export const BRANCH_SCOPED_ROLES = ['branch_manager', 'loan_officer'];
