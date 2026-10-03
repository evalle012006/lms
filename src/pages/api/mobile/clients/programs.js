import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extractKeyFromValue } from '@/lib/fileUtils';
import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { CLIENT_PROGRAM_MOBILE_FIELDS } from '@/lib/mobile-graph.fields';

const graph = new GraphProvider();

const PROGRAM_TYPE = createGraphType('client_programs', `
  ${CLIENT_PROGRAM_MOBILE_FIELDS}
  picture_key
`)('client_programs');

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

export default clientApiHandler({ get: listPrograms });

async function signKey(rawValue) {
    if (!rawValue) return null;
    const rawKey = extractKeyFromValue(rawValue);
    if (!rawKey) return null;

    let objectKey;
    try {
        objectKey = decodeURIComponent(rawKey);
    } catch {
        objectKey = rawKey;
    }

    const command = new GetObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: objectKey });
    return getSignedUrl(s3Client, command, { expiresIn: EXPIRY_SECONDS });
}

async function listPrograms(req, res) {
    try {
        const { clientId } = req.auth;

        const programs = await graph.query(
            queryQl(PROGRAM_TYPE, {
                where: { client_id: { _eq: clientId } },
                order_by: [{ grant_date: 'desc' }],
            })
        ).then(r => r.data?.client_programs ?? []);

        const withSignedPictures = await Promise.all(
            programs.map(async (p) => ({
                ...p,
                pictureUrl: await signKey(p.picture_key).catch(() => null),
                picture_key: undefined, // never send the raw key to the client
            }))
        );

        return res.status(200).json({ success: true, data: withSignedPictures });

    } catch (error) {
        console.error('mobile programs list error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load programs' });
    }
}