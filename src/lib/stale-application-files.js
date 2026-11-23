// Server only. Deletes the Spaces files that belong to a LAF application.
//
// Uploads are stored as `${SPACES_ROOT}/<origin>/<uuid>/<file>`. For the public form the uuid is
// generated in the browser (`laf<timestamp>`), NOT the application id, so the folder can only be
// found from the keys saved on the row. We delete each saved key AND everything else in the same
// per-submission folder (earlier retakes of a photo), but only for the known LAF origins.

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

export const LAF_FILE_ORIGINS = [
    'laf-photos', 'laf-id-photos', 'laf-selfie-with-id', 'face-enroll-thumbnail', 'ci-selfies',
];

/** Row columns / CI columns that hold a Spaces key. */
export const APPLICATION_KEY_FIELDS = [
    'lafPhotoKey', 'governmentIdPhotoKey', 'selfieWithIdPhotoKey', 'faceEnrollPhotoKey',
];

/**
 * `<root>/<origin>/<uuid>/` for a key inside a known LAF origin, else null.
 * Anything else (a stray key, a shared folder) is deleted as the single object only.
 */
export function folderPrefixOf(key, root = process.env.SPACES_ROOT) {
    if (typeof key !== 'string' || !root) return null;
    const origins = LAF_FILE_ORIGINS.join('|');
    const esc = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = key.match(new RegExp(`^(${esc}/(?:${origins})/[^/]+/)[^/]+`));
    return m ? m[1] : null;
}

/** Every object key to delete for these keys (dry-run safe: lists, never deletes). */
export async function expandKeys(keys) {
    const out = new Set();
    const prefixes = new Set();
    for (const k of keys.filter(Boolean)) {
        out.add(k);
        const p = folderPrefixOf(k);
        if (p) prefixes.add(p);
    }
    for (const Prefix of prefixes) {
        let ContinuationToken;
        do {
            const res = await s3.send(new ListObjectsV2Command({
                Bucket: process.env.SPACES_BUCKET, Prefix, ContinuationToken,
            }));
            (res.Contents || []).forEach(o => out.add(o.Key));
            ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
        } while (ContinuationToken);
    }
    return [...out];
}

/** Delete keys (a missing object is not an error). Throws if storage rejects the call. */
export async function deleteKeys(keys) {
    const all = [...new Set(keys.filter(Boolean))];
    for (let i = 0; i < all.length; i += 1000) {
        const res = await s3.send(new DeleteObjectsCommand({
            Bucket: process.env.SPACES_BUCKET,
            Delete: { Objects: all.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true },
        }));
        if (res.Errors?.length) {
            throw new Error(`Spaces delete failed for ${res.Errors.length} object(s): ${res.Errors[0].Code} ${res.Errors[0].Key}`);
        }
    }
    return all.length;
}
