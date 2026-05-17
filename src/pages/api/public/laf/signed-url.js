// src/pages/api/public/laf/signed-url.js
// GET ?key=lms/clients/xxx.jpg
// Returns a signed URL for a private Spaces object.
// Protected by x-laf-api-key — no JWT needed (public LAF page).

import { publicApiHandler }        from '@/services/public-api-handler';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl }              from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
    endpoint:    'https://sgp1.digitaloceanspaces.com',
    region:      'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

export default publicApiHandler({ get: getSignedUrlHandler });

async function getSignedUrlHandler(req, res) {
    const { key } = req.query;

    if (!key?.trim()) {
        return res.status(200).json({ success: false, message: 'key required.' });
    }

    // Only allow keys within our SPACES_ROOT — prevent enumeration of other paths
    const root = process.env.SPACES_ROOT || 'lms';
    if (!key.startsWith(root + '/')) {
        return res.status(200).json({ success: false, message: 'Invalid key.' });
    }

    try {
        const url = await getSignedUrl(
            s3,
            new GetObjectCommand({
                Bucket: process.env.SPACES_BUCKET,
                Key:    key,
            }),
            { expiresIn: 900 } // 15 min
        );

        // Cache header so repeated requests for same key don't hit S3 unnecessarily
        res.setHeader('Cache-Control', 'private, max-age=840'); // 14 min
        return res.status(200).json({ success: true, url, expiresIn: 900 });
    } catch (err) {
        return res.status(200).json({ success: false, message: 'Could not generate URL.' });
    }
}