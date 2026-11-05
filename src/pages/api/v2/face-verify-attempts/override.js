// src/pages/api/v2/face-verify-attempts/override.js
// POST { clientId, loanId, ciReferenceCode, reason }
// Administrator override of a failed / missing face verification at disbursement.
// This RECORDS the override (audit log + client timeline). It does not approve anything itself.
import { apiHandler }                           from '@/services/api-handler';
import { GraphProvider }                        from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { findUserById }                         from '@/lib/graph.functions';
import { isSystemAdmin }                        from '@/lib/ci-scope';
import { resolveClientInScope }                 from '@/lib/client-scope';
import { logAudit }                             from '@/lib/audit';
import { MIN_RECAPTURE_REASON_LENGTH }          from '@/lib/face-recapture-utils';

const graph = new GraphProvider();
const CLIENT_FACE_TYPE = createGraphType('client', '_id firstName lastName branchId faceTemplate');
const LOAN_TYPE        = createGraphType('loans', '_id clientId status ldfApproved');
const ATTEMPT_TYPE     = createGraphType('face_verify_attempts', '_id');

export default apiHandler({ post: overrideFaceVerification });

const fail = (res, message) => res.status(200).json({ success: false, message });

async function overrideFaceVerification(req, res) {
    const { clientId, loanId, ciReferenceCode, reason } = req.body;
    const reasonText = typeof reason === 'string' ? reason.trim() : '';

    if (typeof clientId !== 'string' || !clientId || typeof loanId !== 'string' || !loanId) {
        return fail(res, 'clientId and loanId are required.');
    }
    if (reasonText.length < MIN_RECAPTURE_REASON_LENGTH) {
        return fail(res, `A reason of at least ${MIN_RECAPTURE_REASON_LENGTH} characters is required.`);
    }

    const user = await findUserById(req.auth?.sub);
    if (!user) return fail(res, 'User not found.');
    if (!isSystemAdmin(user)) return fail(res, 'Only an administrator can override face verification.');
    if (!(await resolveClientInScope(user, clientId))) return fail(res, 'Client not found.');

    const { clients, loans, mismatchAgg } = await graph.query(
        queryQl(CLIENT_FACE_TYPE('clients'), { where: { _id: { _eq: clientId } }, limit: 1 }),
        queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: loanId } }, limit: 1 }),
        aggregateQl(ATTEMPT_TYPE('mismatchAgg'), `aggregate { count }`, {
            _and: [{ client_id: { _eq: clientId } }, { loan_id: { _eq: loanId } }, { matched: { _eq: false } }],
        })
    ).then(r => r.data);

    const client = clients?.[0];
    const loan   = loans?.[0];
    if (!client) return fail(res, 'Client not found.');
    if (!loan || loan.clientId !== clientId) return fail(res, 'Loan does not belong to this client.');
    // LDF-approved loans (ldfApproved = true) are exactly the ones in the disbursement window; only a loan that
    // has already been disbursed (status 'active') is out of bounds.
    if (loan.status !== 'pending') {
        return fail(res, 'Overrides are only allowed while the loan is pending final approval.');
    }

    const kind = client.faceTemplate ? 'mismatch_override' : 'no_template_override';
    const mismatchCount = mismatchAgg?.aggregate?.count ?? 0;
    const actorName = `${user.firstName} ${user.lastName}`;

    await logAudit(req, {
        action: 'CLIENT_FACE_VERIFICATION_OVERRIDDEN', category: 'BIOMETRIC', severity: 'CRITICAL',
        entityType: 'client', entityId: clientId, clientId,
        description: `Face verification overridden for ${client.firstName} ${client.lastName} by ${actorName}. Reason: ${reasonText}`,
        branchId: client.branchId,
        userId: user._id, userName: actorName,
        metadata: {
            clientId, loanId, ciReferenceCode: ciReferenceCode ?? null,
            reason: reasonText, kind, mismatchCount, approvedBy: user._id,
        },
    });

    return res.status(200).json({ success: true, kind });
}