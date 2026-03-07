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

// Pre-signed URL expiry: 1 hour
// Increase if users report "expired" errors on slow connections
const EXPIRY_SECONDS = 3600;

export default apiHandler({
  get: getSignedFileUrl,
});

async function getSignedFileUrl(req, res) {
  // req.auth.sub is set by the JWT middleware in apiHandler — no next-auth needed
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({ error: "Missing required query param: key" });
  }

  // Handles both legacy full URLs and new storage keys
  const rawKey = extractKeyFromValue(key);

  if (!rawKey) {
    return res.status(400).json({ error: "Invalid key or URL provided" });
  }

  // Decode any URL-encoded characters in the key (e.g. %20 → space, %2520 → %20 → space).
  // Filenames with spaces/special chars get stored as "file%20name.jpg" in the DB but the
  // actual S3 object key uses a literal space. Without this, the key gets
  // double-encoded (%2520) and S3 returns NoSuchKey.
  let objectKey;
  try {
    objectKey = decodeURIComponent(rawKey);
  } catch {
    // If decoding fails (malformed encoding), use the raw key as-is
    objectKey = rawKey;
  }

  const command = new GetObjectCommand({
    Bucket: process.env.SPACES_BUCKET,
    Key: objectKey,
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: EXPIRY_SECONDS,
  });

  // Cache slightly under expiry to avoid race conditions
  res.setHeader("Cache-Control", `private, max-age=${EXPIRY_SECONDS - 60}`);
  return res.status(200).json({ url: signedUrl, expiresIn: EXPIRY_SECONDS });
}