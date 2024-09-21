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

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.SPACES_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      // Use a temporary key
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

          const prefix = `lms/${origin}/${uuid}/`;

          // Delete existing file
          await deleteExistingFile(process.env.SPACES_BUCKET, prefix);

          // Set the key for the new file
          const newKey = `${prefix}${Date.now().toString()}-${req.file.originalname}`;

          // Copy the file to the new location
          const copyParams = {
            Bucket: process.env.SPACES_BUCKET,
            CopySource: `${process.env.SPACES_BUCKET}/${req.file.key}`,
            Key: newKey,
            ACL: 'public-read'
          };

          await s3Client.send(new CopyObjectCommand(copyParams));

          // Delete the original file
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.SPACES_BUCKET,
            Key: req.file.key
          }));

          req.file.key = newKey;
          req.file.location = `https://${process.env.SPACES_BUCKET}.sgp1.digitaloceanspaces.com/${newKey}`;

          resolve();
        });
      });

      res.status(200).json({ fileUrl: req.file.location });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}