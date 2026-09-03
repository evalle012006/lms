// src/lib/generate-password.js
//
// Generates a short, easy-to-write-down temporary password for
// admin-issued account creation / password resets. Not meant to be a
// long-term password — the login flow already forces a change on first
// use via the existing NO_PASS-style handling, this just replaces "blank
// password, accept anything" with an actual known value the admin can
// hand to the user.
//
// Format: 4 letters + 4 digits, e.g. "TQXK4821" — long enough to not be
// trivially guessable in the short window before the user changes it,
// short enough to read aloud or type from a sticky note without errors.

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O — avoid confusion with 1/0
const DIGITS  = '23456789';                 // no 0/1 for the same reason

const pick = (chars, count) =>
    Array.from({ length: count }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

export function generateTempPassword() {
    return pick(LETTERS, 4) + pick(DIGITS, 4);
}