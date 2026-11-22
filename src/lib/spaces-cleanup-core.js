// src/lib/spaces-cleanup-core.js
// Pure helpers for the Spaces orphan cleanup (no S3 / GraphQL imports, so they are unit-testable).
// Used by src/lib/spaces-cleanup.js.

import { extractKeyFromValue } from '@/lib/fileUtils';

export const QUARANTINE_PREFIX = 'to-delete/';
export const TEMP_PREFIX = 'temp/';

export const spacesRoot = () => process.env.SPACES_ROOT || 'lms';

/**
 * Only keys under these prefixes are ever listed, flagged or touched. The bucket may hold other apps' data
 * (e.g. HRIS), so nothing outside LMS's own root is considered. Override with SPACES_CLEANUP_PREFIXES="lms/,temp/".
 */
export const scanPrefixes = () => {
    const env = (process.env.SPACES_CLEANUP_PREFIXES || '').split(',').map(s => s.trim()).filter(Boolean);
    return env.length ? env : [`${spacesRoot()}/`, TEMP_PREFIX];
};

/** Prefixes that are written/read by the app but never referenced from a table. NEVER flagged. */
export const protectedPrefixes = () => [
    `${spacesRoot()}/log-archive/`,          // gzipped audit-log archives (lib/log-archive.js)
    `${spacesRoot()}/dashboard-activities/`, // slider images, managed by listing the prefix (activity-images.js)
    QUARANTINE_PREFIX,
];

// A file is only a candidate once it is older than this — uploads happen BEFORE the DB row that references them
// is saved, and loans_history snapshots (3 days) can still point at an older photo for rollbacks.
export const MIN_AGE_HOURS = Number(process.env.SPACES_CLEANUP_MIN_AGE_HOURS) || 168; // 7 days
export const TEMP_MIN_AGE_HOURS = 24;
export const PURGE_RETENTION_DAYS = Number(process.env.SPACES_CLEANUP_RETENTION_DAYS) || 14;

export const minAgeMs = (key) => (key.startsWith(TEMP_PREFIX) ? TEMP_MIN_AGE_HOURS : MIN_AGE_HOURS) * 3600 * 1000;

/** Defence in depth: checked at scan time AND again at action time, never trusting the DB row. */
export function isCleanable(key) {
    if (!key || typeof key !== 'string' || key.endsWith('/')) return false;
    if (protectedPrefixes().some(p => key.startsWith(p))) return false;
    return scanPrefixes().some(p => key.startsWith(p));
}

/** 'lms/laf-photos/<uuid>/x.jpg' -> 'lms/laf-photos'; 'temp/1-x.jpg' -> 'temp'. */
export function prefixLabel(key) {
    const parts = key.split('/');
    return parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
}

export const quarantineKeyOf = (key) => `${QUARANTINE_PREFIX}${key}`;

/**
 * Every form a stored DB value could take as an object key. Deliberately generous (raw, decoded, bucket-stripped):
 * an extra variant can only PROTECT a file, a missing one would flag a live file as orphan.
 * Skips huge values (old base64 blobs in `profile`) — they are not keys.
 */
export function referenceVariants(value, bucket = process.env.SPACES_BUCKET) {
    const raw = extractKeyFromValue(value);
    if (!raw || raw.length > 1024 || raw.startsWith('data:')) return [];
    const out = new Set([raw]);
    try { out.add(decodeURIComponent(raw)); } catch { /* keep raw only */ }
    if (bucket) for (const k of [...out]) if (k.startsWith(`${bucket}/`)) out.add(k.slice(bucket.length + 1));
    return [...out];
}

/** Values to search for in a DB column when asking "is this key still referenced?" (legacy URL forms included). */
export function lookupVariants(key, bucket = process.env.SPACES_BUCKET) {
    const enc = encodeURI(key);
    const out = new Set([key, enc]);
    if (bucket) for (const k of [key, enc]) out.add(`https://${bucket}.sgp1.digitaloceanspaces.com/${k}`);
    return [...out];
}

/** Hasura tables + the columns that hold a Spaces key or legacy URL. Table names verified against graph.fields.js / API routes. */
export const REFERENCE_SOURCES = [
    { table: 'client', columns: ['profile', 'governmentIdPhotoKey', 'selfieWithIdPhotoKey', 'faceEnrollPhotoKey'] },
    { table: 'users', columns: ['profile'] },
    { table: 'loans', columns: ['disbursementPhotoKey', 'guarantorPhotoKey', 'guarantorIdPhotoKey'] },
    { table: 'temporaryLoanApplications', columns: ['lafPhotoKey', 'governmentIdPhotoKey', 'selfieWithIdPhotoKey', 'faceEnrollPhotoKey'] },
    { table: 'ciInvestigations', columns: ['selfieKey'] },
    { table: 'client_programs', columns: ['picture_key'] },
    { table: 'client_program_attachments', columns: ['file_key'] },
    { table: 'closing_documents', columns: ['file_key'] },
    { table: 'unclaimed_amount_transactions', columns: ['document_url'] },
    { table: 'face_verify_attempts', columns: ['photo_key'] },
    { table: 'client_face_enrollments', columns: ['photo_key'] },
    { table: 'disbursement_client_photos', columns: ['photo_key'] },
];
