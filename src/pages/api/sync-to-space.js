import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

const s3Client = new S3Client({
  endpoint: "https://sgp1.digitaloceanspaces.com",
  region: "sgp1",
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY
  },
  forcePathStyle: false
});

let totalFiles = 0;
let uploadedFiles = 0;
let failedUploads = [];
let successfulUploads = [];

const countFiles = (folderPath) => {
  let count = 0;
  const items = fs.readdirSync(folderPath);
  for (const item of items) {
    const itemPath = path.join(folderPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      count += countFiles(itemPath);
    } else {
      count++;
    }
  }
  return count;
};

const uploadFile = async (bucket, key, filePath) => {
  try {
    const fileStream = fs.createReadStream(filePath);
    const uploadParams = {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ACL: 'public-read'
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    uploadedFiles++;
    successfulUploads.push(key);
    const percentage = ((uploadedFiles / totalFiles) * 100).toFixed(2);
    console.log(`Uploaded file: ${key} (${percentage}% complete)`);
  } catch (error) {
    failedUploads.push({ key, error: error.message });
    console.error(`Failed to upload ${key}: ${error.message}`);
  }
};

const uploadFolder = async (bucket, prefix, folderPath) => {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      await uploadFolder(bucket, `${prefix}${file}/`, filePath);
    } else {
      const key = `${prefix}${file}`;
      await uploadFile(bucket, key, filePath);
    }
  }
};

const syncLocalFolderToSpace = async () => {
  const localFolderPath = '/Users/xdonie11/Downloads/clients';
  const spacesPrefix = `${process.env.SPACES_ROOT}/clients/`;

  try {
    console.log('Counting files...');
    totalFiles = countFiles(localFolderPath);
    console.log(`Total files to upload: ${totalFiles}`);

    console.log('Starting upload...');
    await uploadFolder(process.env.SPACES_BUCKET, spacesPrefix, localFolderPath);

    console.log('\nSync completed');
    console.log(`Successfully uploaded: ${successfulUploads.length} files`);
    console.log(`Failed uploads: ${failedUploads.length} files`);

    if (failedUploads.length > 0) {
      console.log('\nFailed uploads:');
      failedUploads.forEach(({key, error}) => {
        console.log(`- ${key}: ${error}`);
      });
    }

    if (successfulUploads.length > 0) {
      console.log('\nSuccessfully uploaded files:');
      successfulUploads.forEach(key => {
        console.log(`- ${key}`);
      });
    }

  } catch (error) {
    console.error('Error during sync:', error);
  }
};

// Run the sync function
syncLocalFolderToSpace();