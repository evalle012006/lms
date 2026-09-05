// src/pages/api/v2/laf/pending-validation-list.js
// GET — list all temporaryLoanApplications with status='pending_validation'.
// Feeds the "Flagged as Duplicate" tab in ci-investigation/index.js.
// Same role gate as validate-duplicate.js — admin, supervisors, or BM.

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS }     from '@/lib/graph.fields';
import { findUserById }             from '@/lib/graph.functions';
import { S3Client, GetObjectCommand }  from '@aws-sdk/client-s3';
import { getSignedUrl }                from '@aws-sdk/s3-request-presigner';

const graph = new GraphProvider();
const TEMP_TYPE = createGraphType(
    'temporaryLoanApplications', TEMP_LOAN_APP_FIELDS
)('temporaryLoanApplications');

const s3 = new S3Client({
    endpoint:       'https://sgp1.digitaloceanspaces.com',
    region:         'sgp1',
    credentials:    {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function getSignedUrlForKey(key) {
    if (!key) return null;
    return getSignedUrl(s3, new GetObjectCommand({
        Bucket: process.env.SPACES_BUCKET,
        Key:    key,
    }), { expiresIn: 900 });
}

export default apiHandler({ get: getPendingValidationList });

async function getPendingValidationList(req, res) {
    const { search, limit: limitStr, offset: offsetStr } = req.query;
    const limit  = Math.min(parseInt(limitStr) || 20, 50);
    const offset = parseInt(offsetStr) || 0;

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    const isAdmin      = currentUser.role?.rep === 1 || currentUser.root === true;
    const isSupervisor = currentUser.role?.rep === 2 &&
        (currentUser.role?.shortCode === 'deputy_director' || currentUser.role?.shortCode === 'regional_manager'
            || currentUser.role?.shortCode === 'area_admin'
        );
    const isBM = currentUser.role?.shortCode === 'branch_manager';

    if (!isAdmin && !isSupervisor && !isBM) {
        return res.status(200).json({
            success: false,
            message: 'Only system administrators, supervisors, or branch managers can view this list.',
        });
    }

    const where = { status: { _eq: 'pending_validation' } };
    if (isBM && !isAdmin && !isSupervisor && currentUser.designatedBranchId) {
        where.branchId = { _eq: currentUser.designatedBranchId };
    }
    if (search?.trim()) {
        const term = search.trim().toUpperCase();
        where._or = [
            { firstName: { _ilike: `%${term}%` } },
            { lastName:  { _ilike: `%${term}%` } },
            { ciReferenceCode: { _ilike: `%${term}%` } },
        ];
    }

    const [applications, totalCount] = await Promise.all([
        graph.query(
            queryQl(TEMP_TYPE, {
                where,
                order_by: [{ submittedAt: 'desc' }],
                limit,
                offset,
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []),
        graph.query(
            queryQl(
                createGraphType('temporaryLoanApplications_aggregate', 'aggregate { count }')('temporaryLoanApplications_aggregate'),
                { where }
            )
        ).then(r => r.data?.temporaryLoanApplications_aggregate?.aggregate?.count ?? 0)
            .catch(() => null), // aggregate type may not be tracked — fall back below
    ]);

    const withPhotos = await Promise.all(
        applications.map(async app => ({
            ...app,
            lafPhotoUrl: app.lafPhotoKey
                ? await getSignedUrlForKey(app.lafPhotoKey).catch(() => null)
                : null,
        }))
    );

    return res.status(200).json({
        success:      true,
        applications: withPhotos,
        total:        totalCount ?? withPhotos.length, // fallback if aggregate unavailable
        hasMore:      withPhotos.length === limit,
    });
}