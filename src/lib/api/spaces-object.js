// Server only. Storage-side checks for keys the browser hands us.
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

// Mirrors api/upload.js: `${SPACES_ROOT}/${origin}/${uuid}/` with origin 'disbursement' and
// uuid `client-${loanId}` (set by DisbursementClientPhotoStep).
export const disbursementClientPhotoPrefix = (loanId) =>
    `${process.env.SPACES_ROOT}/disbursement/client-${loanId}/`;

/** true / false for "found" / "not found". Throws on anything else (storage unreachable, bad credentials). */
export async function objectExists(key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: key }));
        return true;
    } catch (e) {
        if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return false;
        throw e;
    }
}