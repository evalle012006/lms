import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { extractKeyFromValue } from "@/lib/fileUtils";
import { apiHandler } from "@/services/api-handler";

const s3Client = new S3Client({
  endpoint: "https://sgp1.digitaloceanspaces.com",
  region: "sgp1",
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY,
  },
  forcePathStyle: false,
});

const EXPIRY_SECONDS = 3600;

export default apiHandler({
  post: getBulkSignedUrls,
});

async function getBulkSignedUrls(req, res) {
  const { keys } = req.body;

  if (!Array.isArray(keys) || keys.length === 0) {
    return res.status(400).json({ error: "Missing or empty 'keys' array" });
  }

  const uniqueKeys = [...new Set(keys.filter(Boolean))];

  const results = await Promise.allSettled(
    uniqueKeys.map(async (key) => {
      const rawKey = extractKeyFromValue(key);
      if (!rawKey) return { key, url: null };

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

      const url = await getSignedUrl(s3Client, command, { expiresIn: EXPIRY_SECONDS });
      return { key, url };
    })
  );

  const urlMap = {};
  results.forEach((r) => {
    if (r.status === "fulfilled" && r.value?.url) {
      urlMap[r.value.key] = r.value.url;
    }
  });

  res.setHeader("Cache-Control", `private, max-age=${EXPIRY_SECONDS - 60}`);
  return res.status(200).json({ urlMap, expiresIn: EXPIRY_SECONDS });
}