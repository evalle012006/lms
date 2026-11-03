// src/lib/api/faceApprovalProof.js  (server only)
// Server-side proof that every loan being disbursement-approved on a v2 branch went through client
// face verification. The browser's own "verified" state and skippedClientIds are never trusted.
//
// A loan is PROVEN when any of these exist for it:
//   - a matched face_verify_attempts row                          (client matched the reference)
//   - a client_face_enrollments row from this disbursement        (first enrollment / supervisor re-enrollment)
//   - an administrator override audit entry carrying its loan id  (CLIENT_FACE_VERIFICATION_OVERRIDDEN)
//   - a disbursement_client_photos row, ONLY while the loan's branch has skipClientFaceVerify on
// Limitation: attempt rows and photo keys are posted by the browser, so a caller with a decision role who
// forges one can still pass. Raising the bar is the point here; computing the match server-side is the next step.
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findBranches, resolveClientFlowStatus } from '@/lib/graph.functions';
import { isOfflineModeActive } from '@/lib/offline-mode';
import { disbursementClientPhotoPrefix, objectExists } from '@/lib/api/spaces-object';

const graph = new GraphProvider();
const SETTINGS_TYPE   = createGraphType('settings', 'requireClientBiometric')('settings');
const ATTEMPT_TYPE    = createGraphType('face_verify_attempts', '_id loan_id');
const ENROLLMENT_TYPE = createGraphType('client_face_enrollments', '_id loan_id');
const AUDIT_TYPE      = createGraphType('audit_logs', '_id clientId metadata');
const PHOTO_TYPE      = createGraphType('disbursement_client_photos', '_id loan_id photo_key captured_at');

export const FACE_OVERRIDE_ACTION    = 'CLIENT_FACE_VERIFICATION_OVERRIDDEN';
export const FACE_ENROLLMENT_SOURCES = ['disbursement_first', 'disbursement_recapture'];

/** Only FINAL approvals (the guard rebuilt them as 'active') need face proof — not pre-approvals. */
export function finalApprovalRows(rows, rebuilt) {
    const finalIds = new Set(
        (Array.isArray(rebuilt) ? rebuilt : []).filter((l) => l?.status === 'active').map((l) => l._id)
    );
    return (Array.isArray(rows) ? rows : []).filter((r) => finalIds.has(r?._id));
}

/** Messages for loans that need face verification and have no proof of it. Throws if it cannot check. */
export async function collectFaceProofDenials(rows) {
    const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
    if (list.length === 0) return [];

    const [setting] = await graph.query(queryQl(SETTINGS_TYPE, { limit: 1 })).then((r) => r.data?.settings ?? []);
    if ((setting?.requireClientBiometric ?? true) === false) return [];

    // Only v2 branches use the disbursement face step
    const branchIds = [...new Set(list.map((r) => r.branchId).filter(Boolean))];
    const branches = branchIds.length
        ? await findBranches({ _id: { _in: branchIds } }, '_id clientFlowVersion skipClientFaceVerify skipClientFaceVerifyUntil')
        : [];
    const v2 = new Set(branches.filter((b) => b.clientFlowVersion === 'v2').map((b) => b._id));
    // Offline mode: a saved client photo is accepted in place of face verification (read here, never from the browser)
    const photoMode = new Set(
        branches.filter((b) => b.clientFlowVersion === 'v2' && isOfflineModeActive(b)).map((b) => b._id)
    );
    const onV2 = list.filter((r) => v2.has(r.branchId));
    if (onV2.length === 0) return [];

    // Legacy clients (no promoted LAF application) are exempt — decided HERE, not by the browser.
    // A client with no entry at all is treated as required (fail-closed).
    const flow = await resolveClientFlowStatus([...new Set(onV2.map((r) => r.clientId).filter(Boolean))]);
    const required = onV2.filter((r) => (Object.prototype.hasOwnProperty.call(flow, r.clientId) ? flow[r.clientId] : true));
    if (required.length === 0) return [];

    const loanIds = required.map((r) => r._id);
    const photoLoanIds = required.filter((r) => photoMode.has(r.branchId)).map((r) => r._id);
    const clientIds = [...new Set(required.map((r) => r.clientId).filter(Boolean))];

    const { faceMatched, faceEnrolled, faceOverrides, clientPhotos } = await graph.query(
        queryQl(ATTEMPT_TYPE('faceMatched'), { where: { loan_id: { _in: loanIds }, matched: { _eq: true } } }),
        queryQl(ENROLLMENT_TYPE('faceEnrolled'), { where: { loan_id: { _in: loanIds }, source: { _in: FACE_ENROLLMENT_SOURCES } } }),
        queryQl(AUDIT_TYPE('faceOverrides'), { where: { action: { _eq: FACE_OVERRIDE_ACTION }, clientId: { _in: clientIds } } }),
        queryQl(PHOTO_TYPE('clientPhotos'), {
            where: { loan_id: { _in: photoLoanIds } },
            order_by: [{ captured_at: 'desc' }],
        })
    ).then((r) => r.data);

    const proven = new Set([
        ...(faceMatched ?? []).map((a) => a.loan_id),
        ...(faceEnrolled ?? []).map((e) => e.loan_id),
        ...(faceOverrides ?? []).map((o) => o.metadata?.loanId),
    ].filter(Boolean));
    // A saved photo only counts if its object still exists in storage and sits under THIS loan's folder.
    // Only the newest row per loan is checked (a retake replaces the file, leaving older rows dead).
    // objectExists throws on anything but "not found", so unreachable storage fails the guard closed in
    // enforce mode instead of silently passing.
    const latestPhotoByLoan = new Map();
    (clientPhotos ?? []).forEach((p) => {
        if (p?.loan_id && !latestPhotoByLoan.has(p.loan_id)) latestPhotoByLoan.set(p.loan_id, p);
    });
    const photoChecks = await Promise.all([...latestPhotoByLoan.values()].map(async (p) =>
        (typeof p.photo_key === 'string'
            && p.photo_key.startsWith(disbursementClientPhotoPrefix(p.loan_id))
            && (await objectExists(p.photo_key))) ? p.loan_id : null
    ));
    const photoProven = new Set(photoChecks.filter(Boolean));

    return required
        .filter((r) => !proven.has(r._id) && !(photoMode.has(r.branchId) && photoProven.has(r._id)))
        .map((r) => {
            const name = r.fullName || r.clientName || 'A client';
            return photoMode.has(r.branchId)
                ? `${name}: the client photo has not been uploaded for this loan (offline mode).`
                : `${name}: face verification has not been completed for this loan.`;
        });
}