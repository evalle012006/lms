import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { CI_INVESTIGATION_FIELDS, TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import { findUserById } from '@/lib/graph.functions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import moment from 'moment';

const graph = new GraphProvider();
const CI_TYPE   = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region:   'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

/**
 * Upload a base64 data URL to DigitalOcean Spaces.
 * Returns the S3 key string on success.
 *
 * @param {string} base64DataUrl  — "data:image/jpeg;base64,/9j/..."
 * @param {string} tempAppId      — used to build a unique S3 path
 */
async function uploadBase64ToSpaces(base64DataUrl, tempAppId) {
    // Strip the data URL prefix: "data:image/jpeg;base64,"
    const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid base64 data URL format.');

    const mimeType  = matches[1];                            // e.g. "image/jpeg"
    const base64    = matches[2];
    const buffer    = Buffer.from(base64, 'base64');
    const ext       = mimeType.split('/')[1] || 'jpg';
    const fileName  = `${Date.now()}-offline-selfie.${ext}`;
    const key       = `lms/ci-selfies/${tempAppId}/${fileName}`;

    await s3.send(new PutObjectCommand({
        Bucket:      process.env.SPACES_BUCKET,
        Key:         key,
        Body:        buffer,
        ContentType: mimeType,
        ACL:         'private',
    }));

    return key;
}

export default apiHandler({ post: syncOfflineDrafts });

async function syncOfflineDrafts(req, res) {
    const { drafts } = req.body;

    if (!Array.isArray(drafts) || drafts.length === 0) {
        return res.status(200).json({ success: false, message: 'No drafts provided.' });
    }

    const user = await findUserById(req.auth.sub);
    if (!user) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    const results = [];

    for (const draft of drafts) {
        const { ciReferenceCode } = draft;

        try {
            const {
                tempApplicationId,
                findings,
                businessVerified,
                addressVerified,
                decision,
                declineReason,
                selfieBase64,   // ← base64 stored offline when no network
            } = draft;

            // ── Validation ────────────────────────────────────────────────
            if (decision === 'approved' && !draft.selfieKey && !selfieBase64) {
                results.push({
                    ciReferenceCode,
                    success: false,
                    error:   'Selfie required for approval — skipped.',
                });
                continue;
            }

            // ── Upload selfie if stored as base64 ─────────────────────────
            // When the CI officer saved offline, the selfie was stored as a
            // base64 data URL in localStorage. Upload it to S3 now.
            let selfieKey = draft.selfieKey || null;
            if (!selfieKey && selfieBase64) {
                try {
                    selfieKey = await uploadBase64ToSpaces(selfieBase64, tempApplicationId);
                } catch (uploadErr) {
                    results.push({
                        ciReferenceCode,
                        success: false,
                        error:   `Selfie upload failed: ${uploadErr.message}`,
                    });
                    continue;
                }
            }

            // ── Save to ciInvestigations ──────────────────────────────────
            await graph.mutation(
                insertQl(CI_TYPE, {
                    objects: [{
                        _id:              generateUUID(),
                        ciReferenceCode,
                        tempApplicationId,
                        findings,
                        businessVerified: !!businessVerified,
                        addressVerified:  !!addressVerified,
                        decision,
                        declineReason:   decision === 'declined' ? declineReason : null,
                        selfieKey:       decision === 'approved'  ? selfieKey    : null,
                        picUserId:       decision === 'approved'  ? req.auth.sub : null,
                        picUserName:     decision === 'approved'
                            ? `${user.firstName} ${user.lastName}` : null,
                        offlinePayload:  draft,               // raw draft stored for audit
                        syncedAt:        new Date().toISOString(),
                        investigatedAt:  draft.investigatedAt || new Date().toISOString(),
                        dateAdded:       moment().format('YYYY-MM-DD'),
                        insertedBy:      req.auth.sub,
                    }],
                    on_conflict: {
                        // Idempotent — safe to re-sync without duplicating
                        constraint: 'ix_ciInv__ciRef_unique',
                        update_columns: [
                            'findings', 'businessVerified', 'addressVerified',
                            'decision', 'declineReason', 'selfieKey',
                            'picUserId', 'picUserName', 'syncedAt',
                            'investigatedAt', 'offlinePayload',
                        ],
                    },
                })
            );

            // ── Update temporaryLoanApplications status ───────────────────
            const newStatus = decision === 'approved' ? 'ci_approved' : 'ci_declined';
            await graph.mutation(
                updateQl(TEMP_TYPE, {
                    set:   { status: newStatus },
                    where: { ciReferenceCode: { _eq: ciReferenceCode } },
                })
            );

            // Release the assignment claim now that sync succeeded
            try {
                await graph.mutation(
                    updateQl(TEMP_TYPE, {
                        where: { ciReferenceCode: { _eq: ciReferenceCode } },
                        set: {
                            assignedTo:      null,
                            assignedAt:      null,
                            assignedByName:  null,
                        },
                    })
                );
            } catch { /* non-fatal — claim will expire naturally */ }

            results.push({ ciReferenceCode, success: true });

        } catch (err) {
            results.push({
                ciReferenceCode,
                success: false,
                error:   err.message,
            });
        }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount    = results.filter(r => !r.success).length;

    return res.status(200).json({
        success: true,
        results,
        summary: { total: drafts.length, synced: successCount, failed: failCount },
    });
}