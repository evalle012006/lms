// src/pages/api/v2/laf/ci/offline-sync.js
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { CI_INVESTIGATION_FIELDS, TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import { findUserById } from '@/lib/graph.functions';
import { canDecideCI, resolveBranchWhere, branchWhereAllows } from '@/lib/ci-scope';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import moment from 'moment';
import { getCurrentDateV2, getSystemDate } from '@/lib/date-utils';
import { validateCIPayload, normalizeCIAnswers } from '@/lib/laf/ci-validation';
import { trimText } from '@/lib/validation-utils';

const SPACES_ROOT = process.env.SPACES_ROOT || 'lms';

const graph = new GraphProvider();
const CI_TYPE   = createGraphType('ciInvestigations',          CI_INVESTIGATION_FIELDS)('ciInvestigations');
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_SETTINGS_TYPE = createGraphType('settings', 'ciQuestions')('settings');
const TEMP_GUARD_TYPE  = createGraphType('temporaryLoanApplications', '_id branchId status')('temporaryLoanApplications');

const s3 = new S3Client({
    endpoint:    'https://sgp1.digitaloceanspaces.com',
    region:      'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function uploadBase64ToSpaces(base64DataUrl, tempAppId) {
    const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid base64 data URL format.');
    const mimeType = matches[1];
    const buffer   = Buffer.from(matches[2], 'base64');
    const ext      = mimeType.split('/')[1] || 'jpg';
    const key      = `${SPACES_ROOT}/ci-selfies/${tempAppId}/${Date.now()}-offline-selfie.${ext}`;
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

    // Guard against req.auth being undefined — can happen when JWT middleware
    // fails to parse the token (stale token, container rotation, etc.)
    const userId = req?.auth?.sub;
    if (!userId) {
        return res.status(200).json({
            success: false,
            message: 'Authentication required. Please log in and try again.',
        });
    }

    const user = await findUserById(userId);
    if (!user) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }
    if (!canDecideCI(user)) {
        return res.status(200).json({
            success: false,
            message: 'You are not allowed to approve or reject a CI investigation.',
        });
    }
    const branchWhere = await resolveBranchWhere(user);
    if (branchWhere === null) {
        return res.status(200).json({ success: false, message: 'You do not have access to these applications.' });
    }

    // FIX: load CI question definitions once — `required` is read from settings,
    // never from the client-supplied draft. Deliberately NOT wrapped in
    // try/catch: if this fails we must fail the request, not skip validation.
    const [ciSettings] = await graph.query(
        queryQl(CI_SETTINGS_TYPE, { limit: 1 })
    ).then(r => r.data?.settings ?? []);
    const ciQuestions = Array.isArray(ciSettings?.ciQuestions) ? ciSettings.ciQuestions : [];

    const results = [];

    for (const draft of drafts) {
        const { ciReferenceCode } = draft;
        try {
            const {
                tempApplicationId, findings,
                businessVerified, addressVerified,
                decision, declineReason,
                selfieBase64, ciAnswers,
            } = draft;

            if (typeof ciReferenceCode !== 'string' || !ciReferenceCode.trim()) {
                results.push({ ciReferenceCode, success: false, error: 'ciReferenceCode is required.' });
                continue;
            }

            const [application] = await graph.query(
                queryQl(TEMP_GUARD_TYPE, {
                    where: { ciReferenceCode: { _eq: ciReferenceCode } },
                    limit: 1,
                })
            ).then(r => r.data?.temporaryLoanApplications ?? []);

            if (!application || !branchWhereAllows(branchWhere, application.branchId)) {
                results.push({ ciReferenceCode, success: false, error: 'Application not found.' });
                continue;
            }
            if (application.status === 'pending_validation') {
                results.push({
                    ciReferenceCode, success: false,
                    error: 'Flagged as a possible duplicate; it must be validated before a CI decision can be recorded.',
                });
                continue;
            }
            if (application.status === 'promoted') {
                results.push({
                    ciReferenceCode, success: false,
                    error: 'Already promoted to a client record; the decision cannot be changed.',
                });
                continue;
            }

            // FIX: same rules as the online route
            const ciError = validateCIPayload(
                { decision, declineReason, businessVerified, addressVerified, ciAnswers },
                ciQuestions
            );
            if (ciError) {
                results.push({ ciReferenceCode, success: false, error: ciError });
                continue;
            }

            if (decision === 'approved' && !draft.selfieKey && !selfieBase64) {
                results.push({ ciReferenceCode, success: false, error: 'Selfie required for approval.' });
                continue;
            }

            // Upload base64 selfie if stored offline
            let selfieKey = draft.selfieKey || null;
            if (!selfieKey && selfieBase64) {
                try {
                    selfieKey = await uploadBase64ToSpaces(selfieBase64, tempApplicationId);
                } catch (uploadErr) {
                    results.push({ ciReferenceCode, success: false, error: `Selfie upload failed: ${uploadErr.message}` });
                    continue;
                }
            }

            await graph.mutation(
                insertQl(CI_TYPE, {
                    objects: [{
                        _id:             generateUUID(),
                        ciReferenceCode,
                        tempApplicationId,
                        findings,
                        businessVerified: !!businessVerified,
                        addressVerified:  !!addressVerified,
                        decision,
                        declineReason:   decision === 'declined' ? trimText(declineReason) : null,
                        selfieKey:       decision === 'approved'  ? selfieKey    : null,
                        picUserId:       decision === 'approved'  ? userId : null,
                        picUserName:     decision === 'approved'
                            ? `${user.firstName} ${user.lastName}` : null,
                        ciAnswers:       normalizeCIAnswers(ciAnswers),
                        offlinePayload:  draft,
                        syncedAt:        new Date().toISOString(),
                        investigatedAt:  draft.investigatedAt || getSystemDate().toISOString(),
                        dateAdded:       getCurrentDateV2(),
                        insertedBy:      userId,
                    }],
                    on_conflict: {
                        constraint: 'ix_ciInv__ciRef_unique',
                        update_columns: [
                            'findings', 'businessVerified', 'addressVerified',
                            'decision', 'declineReason', 'selfieKey',
                            'picUserId', 'picUserName', 'syncedAt',
                            'investigatedAt', 'offlinePayload',
                            'ciAnswers',
                        ],
                    },
                })
            );

            // Update status
            await graph.mutation(
                updateQl(TEMP_TYPE, {
                    set:   { status: decision === 'approved' ? 'ci_approved' : 'ci_declined' },
                    where: { ciReferenceCode: { _eq: ciReferenceCode } },
                })
            );

            // Release claim — non-fatal if it fails
            try {
                await graph.mutation(
                    updateQl(TEMP_TYPE, {
                        where: { ciReferenceCode: { _eq: ciReferenceCode } },
                        set:   { assignedTo: null, assignedAt: null, assignedByName: null },
                    })
                );
            } catch { /* ignore */ }

            results.push({ ciReferenceCode, success: true });

        } catch (err) {
            results.push({ ciReferenceCode, success: false, error: err.message });
        }
    }

    return res.status(200).json({
        success: true,
        results,
        summary: {
            total:  drafts.length,
            synced: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
        },
    });
}

// Increase Next.js body parser limit — selfieBase64 images can be 5-8MB each
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '50mb',
        },
    },
};