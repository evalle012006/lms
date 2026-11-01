// src/pages/api/v2/laf/pending-validation-list.js
// GET — temporaryLoanApplications with status='pending_validation'.
// Feeds the "Flagged as Duplicate" tab in ci-investigation/index.js.
// Roles: system admin, deputy_director / regional_manager / area_admin, branch_manager.
// Rows are SCOPED by role (see src/lib/ci-scope.js); fail-closed.

import { apiHandler }                           from '@/services/api-handler';
import { GraphProvider }                        from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { findUserById }                         from '@/lib/graph.functions';
import { resolveBranchWhere, getShortCode, canDecideCI } from '@/lib/ci-scope';
import { TEMP_LOAN_APP_QUEUE_FIELDS }           from '@/lib/ci-list-fields';
import { S3Client, GetObjectCommand }           from '@aws-sdk/client-s3';
import { getSignedUrl }                         from '@aws-sdk/s3-request-presigner';

const graph = new GraphProvider();
const TEMP_TYPE = createGraphType(
    'temporaryLoanApplications', TEMP_LOAN_APP_QUEUE_FIELDS
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
    const limit  = Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 50);
    const offset = Math.max(parseInt(offsetStr, 10) || 0, 0);

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    const shortCode = getShortCode(currentUser);

    if (!canDecideCI(currentUser)) {
        return res.status(200).json({
            success: false,
            message: 'Only system administrators, supervisors, or branch managers can view this list.',
        });
    }

    // Fail closed: null = deny (unknown role, missing areaId/designatedBranchId, ...)
    const branchWhere = await resolveBranchWhere(currentUser);
    if (branchWhere === null) {
        console.warn('[laf/pending-validation-list] scope denied', {
            userId: currentUser._id, rep: currentUser.role?.rep, shortCode,
        });
        return res.status(200).json({ success: false, message: 'You do not have access to this list.' });
    }

    const where = { ...branchWhere, status: { _eq: 'pending_validation' } };
    if (search?.trim()) {
        const term = search.trim().toUpperCase();
        where._or = [
            { firstName:       { _ilike: `%${term}%` } },
            { lastName:        { _ilike: `%${term}%` } },
            { ciReferenceCode: { _ilike: `%${term}%` } },
        ];
    }

    const [rows, total] = await Promise.all([
        graph.query(
            queryQl(TEMP_TYPE, {
                where,
                order_by: [{ submittedAt: 'desc' }],
                limit:  limit + 1,   // +1 detects hasMore exactly
                offset,
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []),
        graph.query(
            aggregateQl(
                createGraphType('temporaryLoanApplications', '_id')('tempCount'),
                'aggregate { count }',
                where
            )
        ).then(r => r.data?.tempCount?.aggregate?.count ?? null)
         .catch(() => null),
    ]);

    const hasMore      = rows.length > limit;
    const applications = hasMore ? rows.slice(0, limit) : rows;

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
        total:        total ?? withPhotos.length,
        hasMore,
    });
}