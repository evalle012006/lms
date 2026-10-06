// src/lib/laf/name-match.js
// Shared name/birthdate comparison helpers for the public LAF duplicate checks.
// Used by: pages/api/public/laf/submit.js and pages/api/public/laf/check-duplicate.js
// Keep them in ONE place so the warning shown in the form and the server-side
// enforcement can never disagree.

import moment from 'moment';

// Strips periods/whitespace and uppercases ("P." -> "P").
export const normName = (s) => (s || '').replace(/\./g, '').trim().toUpperCase();

// 'same' | 'conflict' | 'unknown' — tolerant of initials ("P" vs "PANONG").
export function compareMiddle(a, b) {
    const x = normName(a);
    const y = normName(b);
    if (!x || !y) return 'unknown';
    if (x === y) return 'same';
    if ((x.length === 1 || y.length === 1) && x[0] === y[0]) return 'same';
    return 'conflict';
}

// 'same' | 'diff' | 'unknown' — compares by calendar day so ISO timestamps
// and YYYY-MM-DD strings are treated alike.
export function compareBirthdate(a, b) {
    if (!a || !b) return 'unknown';
    return moment(a).isSame(moment(b), 'day') ? 'same' : 'diff';
}

// A record is "clearly a different person" only when BOTH middle name and
// birthdate contradict. Middle name alone is not enough — it is trivially
// changed to evade a check (and changes on marriage).
export function isClearlyDifferentPerson(mid, bd) {
    return mid === 'conflict' && bd === 'diff';
}