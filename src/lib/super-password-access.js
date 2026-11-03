// Pure helper (no server imports) — shared by the API and tests.
// Root only. To let other roles manage the super password, change this one line.
export const canManageSuperPassword = (user) => user?.root === true;

export const SUPER_PASSWORD_MIN_LENGTH = 12;
export const SUPER_PASSWORD_MAX_LENGTH = 128;