import { S3Client, ListObjectsV2Command, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import multer from 'multer';
import multerS3 from 'multer-s3';

const s3Client = new S3Client({
    endpoint: "https://sgp1.digitaloceanspaces.com",
    region: "sgp1",
    credentials: {
        accessKeyId: process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

const deleteExistingFile = async (bucket, prefix) => {
    const listResponse = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1,
    }));
    if (listResponse.Contents?.length > 0) {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: listResponse.Contents[0].Key,
        }));
    }
};

// ── Sanitize filename: remove spaces and special chars ────────────────
const sanitizeFilename = (name) =>
    name
        .replace(/\s+/g, '_')
        .replace(/[^\w.\-]/g, '')
        .toLowerCase();

const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.SPACES_BUCKET,
        key: function (req, file, cb) {
            // Sanitize at upload time — covers all origins globally
            const sanitized = sanitizeFilename(file.originalname);
            cb(null, `temp/${Date.now()}-${sanitized}`);
        },
    }),
}).single('file');

export const config = {
    api: { bodyParser: false },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        await new Promise((resolve, reject) => {
            upload(req, res, async function (err) {
                if (err) return reject(err);
                if (!req.file) return reject(new Error('No file uploaded'));

                try {
                    const origin = req.body.origin || 'test';
                    const uuid   = req.body.uuid   || 'unknown';
                    const prefix = `${process.env.SPACES_ROOT}/${origin}/${uuid}/`;

                    // Delete existing file in destination folder
                    await deleteExistingFile(process.env.SPACES_BUCKET, prefix);

                    // Final key — reuse sanitized filename from temp key
                    const filename = req.file.key.split('/').pop();
                    const newKey   = `${prefix}${filename}`;

                    // Copy from temp → final (encode each path segment)
                    const encodedSource = req.file.key
                        .split('/')
                        .map(seg => encodeURIComponent(seg))
                        .join('/');

                    await s3Client.send(new CopyObjectCommand({
                        Bucket:     process.env.SPACES_BUCKET,
                        CopySource: `${process.env.SPACES_BUCKET}/${encodedSource}`,
                        Key:        newKey,
                    }));

                    // Delete temp file
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.SPACES_BUCKET,
                        Key:    req.file.key,
                    }));

                    req.file.key = newKey;
                    resolve();
                } catch (innerErr) {
                    reject(innerErr);
                }
            });
        });

        // Return only the storage key — never a public URL
        res.status(200).json({ fileKey: req.file.key });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
}