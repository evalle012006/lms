// Server only. Writes a batch of log rows to DigitalOcean Spaces as gzipped NDJSON BEFORE they are deleted
// by the clean-up cron. Throws on any failure so the caller never deletes rows that were not archived.
//   key: <SPACES_ROOT>/log-archive/<table>/<YYYY-MM-DD>/<stamp>-<n>.ndjson.gz
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import zlib from 'zlib';
import { promisify } from 'util';
import { redactBiometrics } from '@/lib/audit-redact';

const gzip = promisify(zlib.gzip);
let s3 = null;
const client = () => s3 ?? (s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: { accessKeyId: process.env.SPACES_ACCESS_KEY, secretAccessKey: process.env.SPACES_SECRET_KEY },
    forcePathStyle: false,
}));

export const archiveEnabled = () =>
    process.env.LOG_ARCHIVE_DISABLE !== 'true' && !!process.env.SPACES_ACCESS_KEY && !!process.env.SPACES_BUCKET;

export const archiveKey = (table, day, stamp, n) =>
    `${process.env.SPACES_ROOT}/log-archive/${table}/${day}/${stamp}-${String(n).padStart(4, '0')}.ndjson.gz`;

/** @returns {Promise<string>} the object key written */
export async function archiveRows(table, rows, { day, stamp, n }) {
    const body = await gzip(rows.map(r => JSON.stringify(redactBiometrics(r))).join('\n') + '\n');
    const key = archiveKey(table, day, stamp, n);
    await client().send(new PutObjectCommand({
        Bucket: process.env.SPACES_BUCKET, Key: key, Body: body,
        ContentType: 'application/gzip', ACL: 'private',
    }));
    return key;
}
