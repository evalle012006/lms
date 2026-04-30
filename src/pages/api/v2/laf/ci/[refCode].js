import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS } from '@/lib/graph.fields';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const graph = new GraphProvider();
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE   = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId: process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function getSignedUrlForKey(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.SPACES_BUCKET,
        Key: key,
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

    // ── Fetch branch name ──────────────────────────────────────────────────
    const [branch] = await graph.query(
        queryQl(BRANCH_TYPE, { where: { _id: { _eq: application.branchId } } })
    ).then(r => r.data?.branches ?? []);

    const [lafPhotoUrl, selfieUrl] = await Promise.all([
        application.lafPhotoKey ? getSignedUrlForKey(application.lafPhotoKey) : Promise.resolve(null),
        investigation?.selfieKey ? getSignedUrlForKey(investigation.selfieKey) : Promise.resolve(null),
    ]);

    res.status(200).json({
        success: true,
        application: {
            ...application,
            branchName: branch?.name || '—',
            branchCode: branch?.code || '—',
            lafPhotoUrl,
        },
        investigation: investigation
            ? { ...investigation, selfieUrl }
            : null,
    });
}