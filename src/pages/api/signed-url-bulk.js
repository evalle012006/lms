import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { extractKeyFromValue } from "@/lib/fileUtils";
import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { findUserById } from "@/lib/graph.functions";
import { resolveBranchWhere, branchWhereAllows } from "@/lib/ci-scope";

const s3Client = new S3Client({
  endpoint: "https://sgp1.digitaloceanspaces.com",
  region: "sgp1",
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY,
  },
  forcePathStyle: false,
});

const graph = new GraphProvider();
const EXPIRY_SECONDS = 3600;
const MAX_KEYS = 200;

// Keys that belong to a temporaryLoanApplication and must respect branch scope
const SPACES_ROOT = process.env.SPACES_ROOT || "lms";
const LAF_PREFIXES = [
  "laf-photos/", "laf-id-photos/", "face-enroll-thumbnail/", "laf-selfie-with-id/",
].map((p) => `${SPACES_ROOT}/${p}`);
const LAF_KEY_COLUMNS = ["lafPhotoKey", "governmentIdPhotoKey", "faceEnrollPhotoKey", "selfieWithIdPhotoKey"];
const OWNER_TYPE = createGraphType(
  "temporaryLoanApplications",
  `branchId status ${LAF_KEY_COLUMNS.join(" ")}`
)("temporaryLoanApplications");

export default apiHandler({
  post: getBulkSignedUrls,
});

async function getBulkSignedUrls(req, res) {
  const { keys } = req.body;

  if (!Array.isArray(keys) || keys.length === 0) {
    return res.status(400).json({ error: "Missing or empty 'keys' array" });
  }

  const user = await findUserById(req.auth?.sub);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // key as sent -> object key as stored
  const keyMap = new Map();
  for (const key of new Set(keys.filter((k) => typeof k === "string" && k))) {
    const rawKey = extractKeyFromValue(key);
    if (!rawKey) continue;
    let objectKey;
    try {
      objectKey = decodeURIComponent(rawKey);
    } catch {
      objectKey = rawKey;
    }
    if (objectKey.includes("..")) continue;
    keyMap.set(key, objectKey);
  }

  if (keyMap.size > MAX_KEYS) {
    return res.status(400).json({ error: `Too many keys (max ${MAX_KEYS})` });
  }

  // ── Scope LAF keys by the owning application's branch ──────────────────
  const lafKeys = [...new Set(
    [...keyMap.values()].filter((k) => LAF_PREFIXES.some((p) => k.startsWith(p)))
  )];

  const ownerBranch = new Map(); // objectKey -> branchId of the owning application
  let branchWhere = null;
  if (lafKeys.length > 0) {
    branchWhere = await resolveBranchWhere(user);
    const owners = await graph.query(
      queryQl(OWNER_TYPE, {
        where: { _or: LAF_KEY_COLUMNS.map((c) => ({ [c]: { _in: lafKeys } })) },
      })
    ).then((r) => r.data?.temporaryLoanApplications ?? []);

    for (const app of owners) {
      // Promoted: these keys are now the client's profile/ID photos shown on client
      // lists across the app. Only the CI working set is scoped here.
      if (app.status === "promoted") continue;
      for (const c of LAF_KEY_COLUMNS) {
        if (app[c]) ownerBranch.set(app[c], app.branchId);
      }
    }
  }

  const isAllowed = (objectKey) => {
    if (!ownerBranch.has(objectKey)) return true; // not an application key: unchanged behaviour
    return branchWhereAllows(branchWhere, ownerBranch.get(objectKey));
  };

  const allowedEntries = [...keyMap].filter(([, objectKey]) => isAllowed(objectKey));
  const deniedCount = keyMap.size - allowedEntries.length;
  if (deniedCount > 0) {
    console.warn("[signed-url-bulk] denied out-of-scope keys", { userId: user._id, deniedCount });
  }

  const results = await Promise.allSettled(
    allowedEntries.map(async ([key, objectKey]) => {
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