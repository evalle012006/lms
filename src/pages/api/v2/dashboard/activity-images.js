// src/pages/api/v2/dashboard/activity-images.js
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { apiHandler } from '@/services/api-handler';

const s3Client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

const EXPIRY_SECONDS = 3600;

export default apiHandler({
    get:  getActivityImages,
    post: deleteActivityImage,   // consistent with all other delete APIs in the project
});

// ── GET — list all slider images with signed URLs ─────────────────────────────
async function getActivityImages(req, res) {
    const prefix = `${process.env.SPACES_ROOT}/dashboard-activities/`;

    const listResponse = await s3Client.send(
        new ListObjectsV2Command({ Bucket: process.env.SPACES_BUCKET, Prefix: prefix })
    );

    const objects = (listResponse.Contents || []).filter((o) => !o.Key.endsWith('/'));

    const images = await Promise.all(
        objects.map(async (obj) => {
            const url = await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: obj.Key }),
                { expiresIn: EXPIRY_SECONDS }
            );
            return { key: obj.Key, url, lastModified: obj.LastModified };
        })
    );

    // Oldest → newest preserves upload order in the slider
    images.sort((a, b) => new Date(a.lastModified) - new Date(b.lastModified));

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, images }));
}

// ── POST — delete a single image by key (body: { key }) ──────────────────────
async function deleteActivityImage(req, res) {
    const { key } = req.body;

    if (!key) {
        return res
            .status(200)
            .json({ success: false, message: 'Missing required field: key' });
    }

    let objectKey;
    try {
        objectKey = decodeURIComponent(key);
    } catch {
        objectKey = key;
    }

    await s3Client.send(
        new DeleteObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: objectKey })
    );

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true }));
}