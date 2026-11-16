// Branch code rules: letters and digits only. No spaces, no special characters.
export const BRANCH_CODE_REGEX = /^[A-Za-z0-9]+$/;
export const BRANCH_CODE_MESSAGE = 'Branch code may only contain letters and numbers (no spaces or special characters)';

// Strips everything that is not a letter or digit (used for live typing in the UI).
export const sanitizeBranchCode = (value) => String(value ?? '').replace(/[^A-Za-z0-9]/g, '');

// Returns an error message, or null when the code is valid. Does NOT trim: " B144" is invalid.
export const validateBranchCode = (code) => {
    if (typeof code !== 'string' || code.length === 0) return 'Please enter code';
    if (!BRANCH_CODE_REGEX.test(code)) return BRANCH_CODE_MESSAGE;
    return null;
};
