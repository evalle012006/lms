// src/pages/api/v2/laf/ci/[refCode].js
// FIX: Added groupName enrichment — temporaryLoanApplications only stores groupId,
// not groupName. Fetch group name from groups table and add to response.
// FIX: Added occurence + weeklyScheduleType — needed by LAFModal (via TempLAFModal)
// to render accelerated-loan promissory note / T&C / CSF text instead of always
// defaulting to standard daily terms. Previously the group query only asked for
// _id/name/status, so these fields never reached the client regardless of what
// TempLAFModal did with application.occurence.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS } from '@/lib/graph.fields';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const graph = new GraphProvider();
const TEMP_TYPE   = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE     = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');
// FIX: added group type to fetch groupName + occurence + weeklyScheduleType
const GROUP_TYPE  = createGraphType('groups', '_id name status occurence weeklyScheduleType')('groups');

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function getSignedUrlForKey(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.SPACES_BUCKET,
        Key:    key,
    });
    return getSignedUrl(s3, command, { expiresIn: 900 });
}

export default apiHandler({ get: getByRefCode });

async function getByRefCode(req, res) {
    const { refCode } = req.query;

    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: refCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'Reference code not found.' });
    }

    const [investigation] = await graph.query(
        queryQl(CI_TYPE, { where: { ciReferenceCode: { _eq: refCode } } })
    ).then(r => r.data?.ciInvestigations ?? []);

    // FIX: fetch branch + group + signed URLs in parallel
    const [
        [branch],
        [group],
        lafPhotoUrl,
        selfieUrl,
    ] = await Promise.all([
        // Branch name
        application.branchId
            ? graph.query(queryQl(BRANCH_TYPE, { where: { _id: { _eq: application.branchId } } }))
                .then(r => r.data?.branches ?? [])
            : Promise.resolve([]),
        // FIX: group name — not stored on LAF record, must be fetched
        application.groupId
            ? graph.query(queryQl(GROUP_TYPE, { where: { _id: { _eq: application.groupId } } }))
                .then(r => r.data?.groups ?? [])
            : Promise.resolve([]),
        // LAF photo signed URL
        application.lafPhotoKey
            ? getSignedUrlForKey(application.lafPhotoKey).catch(() => null)
            : Promise.resolve(null),
        // CI selfie signed URL
        investigation?.selfieKey
            ? getSignedUrlForKey(investigation.selfieKey).catch(() => null)
            : Promise.resolve(null),
    ]);

    res.status(200).json({
        success: true,
        application: {
            ...application,
            branchName: branch?.name || '—',
            branchCode: branch?.code || '—',
            groupName:  group?.name  || '',
            groupStatus: group?.status || '',
            // FIX: occurence/weeklyScheduleType — needed by LAFModal to render
            // accelerated-loan promissory note/T&C text instead of standard terms
            occurence:          group?.occurence          || 'daily',
            weeklyScheduleType: group?.weeklyScheduleType  || null,
            lafPhotoUrl,
        },
        investigation: investigation
            ? { ...investigation, selfieUrl }
            : null,
    });
}