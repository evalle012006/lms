// Mirrors the signing mechanics in pages/api/signed-url.js (same S3 client,
// same presign call) but deliberately does NOT accept a `key` from the
// caller. It looks up the authenticated client's own document key
// server-side and signs only that — a public mobile endpoint that took an
// arbitrary key, like the staff version does, would let any client request
// a signed URL for any file in the bucket.
//
// ?type= selects which of the client's own document keys to sign:
//   profile (default) | governmentId | selfieWithId
// Anything else is rejected — this is a fixed allow-list, not a passthrough.

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extractKeyFromValue } from '@/lib/fileUtils';
import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
  _id profile governmentIdPhotoKey selfieWithIdPhotoKey
`)('clients');

const s3Client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId: process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

const EXPIRY_SECONDS = 3600;

const FIELD_BY_TYPE = {
    profile: 'profile',
    governmentId: 'governmentIdPhotoKey',
    selfieWithId: 'selfieWithIdPhotoKey',
};

export default clientApiHandler({ get: getPhotoUrl });

async function getPhotoUrl(req, res) {
    try {
        const { clientId } = req.auth;
        const type = req.query.type || 'profile';

        const fieldName = FIELD_BY_TYPE[type];
        if (!fieldName) {
            return res.status(400).json({ success: false, message: 'Invalid document type' });
        }

        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
        ).then(r => r.data?.clients ?? []);

        const rawValue = client?.[fieldName];
        if (!rawValue) {
            return res.status(200).json({ success: true, url: null });
        }

        const rawKey = extractKeyFromValue(rawValue);
        if (!rawKey) {
            return res.status(200).json({ success: true, url: null });
        }

        let objectKey;
        try {
            objectKey = decodeURIComponent(rawKey);
        } catch {
            objectKey = rawKey;
        }

        const command = new GetObjectCommand({
            Bucket: process.env.SPACES_BUCKET,
            Key: objectKey,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: EXPIRY_SECONDS });

        return res.status(200).json({ success: true, url: signedUrl, expiresIn: EXPIRY_SECONDS });

    } catch (error) {
        console.error('mobile photo-url error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load photo' });
    }
}