// Deterministic UUID (sha1-based, v5-style): the same loan + date always maps to the same cashCollections id.
// Shared by pre-save-collections and the support "restore missing collection" so the two can never create two rows
// for one loan and date: whichever runs second hits the primary key instead of the (loanId, dateAdded) unique index.
import { createHash } from 'crypto';

export const presaveId = (loanId, date) => {
    const h = createHash('sha1').update(`presave|${loanId}|${date}`).digest();
    h[6] = (h[6] & 0x0f) | 0x50;
    h[8] = (h[8] & 0x3f) | 0x80;
    const x = h.subarray(0, 16).toString('hex');
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
};
