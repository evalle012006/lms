import { S3Client, ListObjectsV2Command, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import multer from 'multer';
import multerS3 from 'multer-s3';

const s3Client = new S3Client({
  endpoint: "https://sgp1.digitaloceanspaces.com",
  region: "sgp1",
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY
  },
  forcePathStyle: false
});

const deleteExistingFile = async (bucket, prefix) => {
  const listCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: 1
  });

  const listResponse = await s3Client.send(listCommand);

  if (listResponse.Contents && listResponse.Contents.length > 0) {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: listResponse.Contents[0].Key
    });
    await s3Client.send(deleteCommand);
    console.log(`Deleted existing file: ${listResponse.Contents[0].Key}`);
  }
};

// ✅ ACL removed — bucket/objects are now PRIVATE by default
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.SPACES_BUCKET,
    // No ACL field = inherits bucket default (private)
    key: function (req, file, cb) {
      cb(null, `temp/${Date.now().toString()}-${file.originalname}`);
    }
  })
}).single('file');

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await new Promise((resolve, reject) => {
        upload(req, res, async function (err) {
          if (err) {
            console.error('Multer error:', err);
            return reject(err);
          }

          if (!req.file) {
            return reject(new Error('No file uploaded'));
          }

          const origin = req.body.origin || 'test';
          const uuid = req.body.uuid || 'unknown';

          const prefix = `${process.env.SPACES_ROOT}/${origin}/${uuid}/`;

          // Delete existing file in that folder
          await deleteExistingFile(process.env.SPACES_BUCKET, prefix);

          // Build final key
          const newKey = `${prefix}${Date.now().toString()}-${req.file.originalname}`;

          // Move from temp to final location (no ACL = private)
          const copyParams = {
            Bucket: process.env.SPACES_BUCKET,
            CopySource: `${process.env.SPACES_BUCKET}/${req.file.key}`,
            Key: newKey,
            // ✅ No ACL: 'public-read' — object is private
          };

          await s3Client.send(new CopyObjectCommand(copyParams));

          // Delete the temp file
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.SPACES_BUCKET,
            Key: req.file.key
          }));

          req.file.key = newKey;

          resolve();
        });
      });

      // ✅ Return ONLY the key (path), NOT the full public URL
      // Consumers should call /api/signed-url?key=... to get a temporary URL
      res.status(200).json({ fileKey: req.file.key });

    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}