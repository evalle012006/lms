// src/pages/api/v2/laf/pending-duplicates.js
// GET — returns all temporaryLoanApplications with status=pending_validation
// with branch name, signed LAF photo URLs
// Accessible: rep=1, rep=2 (division/region managers)

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS }     from '@/lib/graph.fields';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl }               from '@aws-sdk/s3-request-presigner';

const graph = new GraphProvider();

const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    ${TEMP_LOAN_APP_FIELDS}
    branchName
    branchCode
`)('temporaryLoanApplications');

const s3 = new S3Client({
    endpoint:       'https://sgp1.digitaloceanspaces.com',
    region:         'sgp1',
    credentials:    { accessKeyId: process.env.SPACES_ACCESS_KEY, secretAccessKey: process.env.SPACES_SECRET_KEY },
    forcePathStyle: false,
});

async function getSignedUrlForKey(key) {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: key }), { expiresIn: 900 });
}

export default apiHandler({ get: getPendingDuplicates });

async function getPendingDuplicates(req, res) {
    const currentUser = req.auth;
    const rep = currentUser?.role?.rep;

    // Only rep=1 (admin) and rep=2 (division managers) can see all
    // rep=3 (BM) is restricted to their branch only — but they don't need this endpoint
    if (rep !== 1 && rep !== 2 && !currentUser?.root) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }

    const where = { status: { _eq: 'pending_validation' } };

    // Division/region managers scoped to their division/region
    if (rep === 2 && currentUser.divisionId) {
        where.branchId = { _in: [] }; // would need branch lookup — simplified for now
    }

    const applications = await graph.query(
        queryQl(TEMP_TYPE, {
            where,
            order_by: [{ submittedAt: 'asc' }], // oldest first
            limit: 100,
        })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    // Attach signed photo URLs
    const withPhotos = await Promise.all(
        applications.map(async app => {
            const lafPhotoUrl = app.lafPhotoKey
                ? await getSignedUrlForKey(app.lafPhotoKey).catch(() => null)
                : null;
            return { ...app, lafPhotoUrl };
        })
    );

    return res.status(200).json({ success: true, applications: withPhotos });
}