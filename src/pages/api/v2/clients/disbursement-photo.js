// POST { loanId, clientId, photoKey }
// Offline mode only (branches.skipClientFaceVerify): records the client photo taken at disbursement
// in place of real-time face verification. Never touches client.profile, faceTemplate or
// client_face_enrollments.
import { apiHandler }   from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl } from '@/lib/graph/graph.util';
import { DISBURSEMENT_CLIENT_PHOTO_FIELDS } from '@/lib/graph.fields';
import { findBranches } from '@/lib/graph.functions';
import { requireApprover } from '@/lib/api/loanApprovalGates';
import { isOfflineModeActive } from '@/lib/offline-mode';
import { disbursementClientPhotoPrefix, objectExists } from '@/lib/api/spaces-object';
import { logAudit }     from '@/lib/audit';
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();
const LOAN_TYPE  = createGraphType('loans', '_id clientId branchId status ldfApproved fullName');
const PHOTO_TYPE = createGraphType('disbursement_client_photos', DISBURSEMENT_CLIENT_PHOTO_FIELDS);

export default apiHandler({ post: saveDisbursementClientPhoto });

const fail = (res, message) => res.status(200).json({ success: false, message });

async function saveDisbursementClientPhoto(req, res) {
    const { loanId, clientId, photoKey } = req.body;
    if (typeof loanId !== 'string' || !loanId || typeof clientId !== 'string' || !clientId) {
        return fail(res, 'loanId and clientId are required.');
    }
    if (typeof photoKey !== 'string' || !photoKey || photoKey.length > 512 || photoKey.includes('..')) {
        return fail(res, 'A valid photo is required.');
    }

    const caller = await requireApprover(req);
    if (caller.error) return fail(res, caller.error);
    // v2 final approval is branch-manager only (finalApprovalBlockers), so only they record this.
    if (caller.mode !== 'branch_manager') return fail(res, 'Only a branch manager can record the client photo.');

    const [loan] = await graph
        .query(queryQl(LOAN_TYPE('foundLoan'), { where: { _id: { _eq: loanId } }, limit: 1 }))
        .then(r => r.data?.foundLoan ?? []);

    const branchIds = caller.scope?.branchIds; // null/undefined = unrestricted
    if (!loan || loan.clientId !== clientId || (branchIds && !branchIds.includes(loan.branchId))) {
        return fail(res, 'Loan not found.');
    }
    // Status only: the disbursement modal opens for loans whose ldfApproved is already true.
    if (loan.status !== 'pending') {
        return fail(res, `The photo can only be recorded while the loan is pending approval (this loan is "${loan.status}").`);
    }

    const [branch] = await findBranches({ _id: { _eq: loan.branchId } }, '_id name skipClientFaceVerify skipClientFaceVerifyUntil');
    if (!isOfflineModeActive(branch)) {
        return fail(res, 'Offline mode is not enabled (or has expired) for this branch.');
    }

    // The browser supplies the key: it must be THIS loan's own upload, and the object must really exist.
    if (!photoKey.startsWith(disbursementClientPhotoPrefix(loanId))) {
        return fail(res, 'The photo does not belong to this loan.');
    }
    try {
        if (!(await objectExists(photoKey))) {
            return fail(res, 'The photo was not found in storage. Please upload it again.');
        }
    } catch {
        return fail(res, 'Could not verify the upload right now. Please try again.');
    }

    const user = caller.user;
    await graph.mutation(
        insertQl(PHOTO_TYPE('bulk_0'), { objects: [{
            _id: generateUUID(), loan_id: loanId, client_id: clientId,
            branch_id: loan.branchId, photo_key: photoKey, captured_by: user._id,
        }] })
    );

    await logAudit(req, {
        action: 'CLIENT_DISBURSEMENT_PHOTO_FALLBACK', category: 'BIOMETRIC', severity: 'WARNING',
        entityType: 'client', entityId: clientId, clientId,
        description: `Client photo recorded in place of face verification (offline mode) for ${loan.fullName || clientId} by ${user.firstName} ${user.lastName}`,
        branchId: loan.branchId, userId: user._id, userName: `${user.firstName} ${user.lastName}`,
        metadata: { loanId, clientId, photoKey },
    });

    return res.status(200).json({ success: true });
}