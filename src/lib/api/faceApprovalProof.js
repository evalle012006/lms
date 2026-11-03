// src/lib/api/faceApprovalProof.js  (server only)
// Server-side proof that every loan being disbursement-approved on a v2 branch went through client
// face verification. The browser's own "verified" state and skippedClientIds are never trusted.
//
// A loan is PROVEN when any of these exist for it:
//   - a matched face_verify_attempts row                          (client matched the reference)
//   - a client_face_enrollments row from this disbursement        (first enrollment / supervisor re-enrollment)
//   - an administrator override audit entry carrying its loan id  (CLIENT_FACE_VERIFICATION_OVERRIDDEN)
// Limitation: attempt rows are posted by the browser, so a caller with a decision role who forges one can
// still pass. Raising the bar is the point here; computing the match server-side is the next step.
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findBranches, resolveClientFlowStatus } from '@/lib/graph.functions';

const graph = new GraphProvider();
const SETTINGS_TYPE   = createGraphType('settings', 'requireClientBiometric')('settings');
const ATTEMPT_TYPE    = createGraphType('face_verify_attempts', '_id loan_id');
const ENROLLMENT_TYPE = createGraphType('client_face_enrollments', '_id loan_id');
const AUDIT_TYPE      = createGraphType('audit_logs', '_id clientId metadata');

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
    const branches = branchIds.length ? await findBranches({ _id: { _in: branchIds } }, '_id clientFlowVersion') : [];
    const v2 = new Set(branches.filter((b) => b.clientFlowVersion === 'v2').map((b) => b._id));
    const onV2 = list.filter((r) => v2.has(r.branchId));
    if (onV2.length === 0) return [];

    // Legacy clients (no promoted LAF application) are exempt — decided HERE, not by the browser.
    // A client with no entry at all is treated as required (fail-closed).
    const flow = await resolveClientFlowStatus([...new Set(onV2.map((r) => r.clientId).filter(Boolean))]);
    const required = onV2.filter((r) => (Object.prototype.hasOwnProperty.call(flow, r.clientId) ? flow[r.clientId] : true));
    if (required.length === 0) return [];

    const loanIds = required.map((r) => r._id);
    const clientIds = [...new Set(required.map((r) => r.clientId).filter(Boolean))];

    const { faceMatched, faceEnrolled, faceOverrides } = await graph.query(
        queryQl(ATTEMPT_TYPE('faceMatched'), { where: { loan_id: { _in: loanIds }, matched: { _eq: true } } }),
        queryQl(ENROLLMENT_TYPE('faceEnrolled'), { where: { loan_id: { _in: loanIds }, source: { _in: FACE_ENROLLMENT_SOURCES } } }),
        queryQl(AUDIT_TYPE('faceOverrides'), { where: { action: { _eq: FACE_OVERRIDE_ACTION }, clientId: { _in: clientIds } } })
    ).then((r) => r.data);

    const proven = new Set([
        ...(faceMatched ?? []).map((a) => a.loan_id),
        ...(faceEnrolled ?? []).map((e) => e.loan_id),
        ...(faceOverrides ?? []).map((o) => o.metadata?.loanId),
    ].filter(Boolean));

    return required
        .filter((r) => !proven.has(r._id))
        .map((r) => `${r.fullName || r.clientName || 'A client'}: face verification has not been completed for this loan.`);
}