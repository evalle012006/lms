// src/pages/api/v2/laf/enroll-face.js
// POST { ciReferenceCode, faceTemplate, faceEnrolledAt, livenessScore }
// Authenticated (BM/LO doing CI review). Backfills a face template onto a
// temporaryLoanApplications row that was synced from offline mode without
// one. promote/[refCode].js already forwards application.faceTemplate onto
// the client record at promotion time, so enrolling here — before promotion
// — requires no changes to the promote path at all.

import { apiHandler }                         from '@/services/api-handler';
import { GraphProvider }                      from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS }               from '@/lib/graph.fields';
import { findUserById }                       from '@/lib/graph.functions';
import { canDecideCI, isBranchInScope }       from '@/lib/ci-scope';
import { logAudit }                           from '@/lib/audit';
import moment from 'moment';

const graph = new GraphProvider();
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default apiHandler({ post: enrollFace });

async function enrollFace(req, res) {
    const { ciReferenceCode, faceTemplate, faceEnrolledAt, livenessScore } = req.body;
    if (typeof ciReferenceCode !== 'string' || !ciReferenceCode.trim() || !faceTemplate) {
        return res.status(200).json({ success: false, message: 'ciReferenceCode and faceTemplate required.' });
    }
    // A face descriptor is 128 numbers; anything else is garbage or an oversized payload
    if (!Array.isArray(faceTemplate) || faceTemplate.length !== 128 || !faceTemplate.every(Number.isFinite)) {
        return res.status(200).json({ success: false, message: 'Invalid face template.' });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });
    if (!canDecideCI(currentUser)) {
        return res.status(200).json({ success: false, message: 'You are not allowed to enroll a face template.' });
    }

    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    // Out-of-scope looks identical to not-found
    if (!application || !(await isBranchInScope(currentUser, application.branchId))) {
        return res.status(200).json({ success: false, message: 'Application not found.' });
    }
    if (application.faceTemplate) {
        return res.status(200).json({ success: false, message: 'This application already has a face template on record.' });
    }

    await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: { ciReferenceCode: { _eq: ciReferenceCode } },
            set: {
                faceTemplate:   JSON.stringify(faceTemplate),
                faceEnrolledAt: faceEnrolledAt || moment().toISOString(),
                livenessScore:  livenessScore != null ? livenessScore : null,
            },
        })
    );

    await logAudit(req, {
        action: 'LAF_FACE_ENROLLED_AT_CI', category: 'CI', severity: 'INFO',
        entityType: 'temporaryLoanApplication', entityId: application._id,
        description: `Face template backfilled at CI review for offline-synced application ${ciReferenceCode} by ${currentUser.firstName} ${currentUser.lastName}`,
        branchId: application.branchId,
        metadata: { ciReferenceCode },
    });

    return res.status(200).json({ success: true, message: 'Face template enrolled.' });
}