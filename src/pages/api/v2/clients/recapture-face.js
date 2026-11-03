// src/pages/api/v2/clients/recapture-face.js
// POST { clientId, loanId, ciReferenceCode, faceTemplate, livenessScore, photoKey, reason }
// Supervisor-approved replacement of a client's reference face at disbursement.
// Never overwrites: the current reference becomes a 'superseded' version row.
import { apiHandler }                                                from '@/services/api-handler';
import { GraphProvider }                                             from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl, insertQl, updateQl } from '@/lib/graph/graph.util';
import { CLIENT_FACE_ENROLLMENT_FIELDS, FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';
import { findUserById }                                              from '@/lib/graph.functions';
import { resolveClientInScope }                                      from '@/lib/client-scope';
import { logAudit }                                                  from '@/lib/audit';
import { generateUUID }                                              from '@/lib/utils';
import {
    canApproveFaceRecapture, MIN_MISMATCHES_FOR_RECAPTURE, MAX_RECAPTURES_PER_LOAN,
    MIN_RECAPTURE_REASON_LENGTH, FACE_MATCH_THRESHOLD, sanitizeLiveness,
} from '@/lib/face-recapture-utils';
import moment from 'moment';
import { isFaceRecaptureEnabled } from '@/lib/face-recapture-settings';

const graph = new GraphProvider();
// Own field lists on purpose: CLIENT_FIELDS may or may not carry faceTemplate.
const CLIENT_FACE_TYPE = createGraphType('client', `
    _id firstName lastName branchId faceTemplate faceEnrolledAt faceEnrollPhotoKey livenessScore
`);
const LOAN_TYPE       = createGraphType('loans', '_id clientId status ldfApproved ciReferenceCode branchId');
const ENROLLMENT_TYPE = createGraphType('client_face_enrollments', CLIENT_FACE_ENROLLMENT_FIELDS);
const ATTEMPT_TYPE    = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS);

export default apiHandler({ post: recaptureFace });

const fail = (res, message, extra = {}) => res.status(200).json({ success: false, message, ...extra });
const isTemplate = (t) => Array.isArray(t) && t.length === 128 && t.every(Number.isFinite);
const euclid = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };
const parseTemplate = (raw) => { try { const t = JSON.parse(raw); return isTemplate(t) ? t : null; } catch { return null; } };

// pgvector duplicate-face detection is staging-only today (faceTemplateVec is not in production).
// When it ships, call it here and block on a hit. Until then the audit entry records 'skipped'.
async function findDuplicateFace(/* template, excludeClientId */) {
    return { available: false, match: null };
}

async function recaptureFace(req, res) {
    const { clientId, loanId, ciReferenceCode, faceTemplate, livenessScore, photoKey, reason } = req.body;
    const reasonText = typeof reason === 'string' ? reason.trim() : '';
    const liveness = sanitizeLiveness(livenessScore);

    if (typeof clientId !== 'string' || !clientId || typeof loanId !== 'string' || !loanId) {
        return fail(res, 'clientId and loanId are required.');
    }
    if (!isTemplate(faceTemplate)) return fail(res, 'A valid face capture is required.');
    if (typeof photoKey !== 'string' || !photoKey) {
        return fail(res, 'The capture photo did not upload. Please retry the capture.');
    }
    if (reasonText.length < MIN_RECAPTURE_REASON_LENGTH) {
        return fail(res, `A reason of at least ${MIN_RECAPTURE_REASON_LENGTH} characters is required.`);
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return fail(res, 'User not found.');
    if (!canApproveFaceRecapture(currentUser)) {
        return fail(res, 'Only an admin, deputy director, regional manager, area admin or branch manager can re-enroll a client face.');
    }
    // Out-of-scope reads exactly like not-found
    if (!(await resolveClientInScope(currentUser, clientId))) return fail(res, 'Client not found.');

    // System Settings → Allow Client Face Re-enrollment. Checked AFTER role and scope (so those refusals
    // read the same either way) and BEFORE any client/loan data is loaded.
    if (!(await isFaceRecaptureEnabled())) {
        return fail(res, 'Face re-enrollment is turned off in System Settings.', { code: 'FEATURE_DISABLED' });
    }

    // ── Load client, loan, current reference ─────────────────────────────
    const { clients, loans, activeEnrollments } = await graph.query(
        queryQl(CLIENT_FACE_TYPE('clients'), { where: { _id: { _eq: clientId } }, limit: 1 }),
        queryQl(LOAN_TYPE('loans'),          { where: { _id: { _eq: loanId } }, limit: 1 }),
        queryQl(ENROLLMENT_TYPE('activeEnrollments'), {
            where: { _and: [{ client_id: { _eq: clientId } }, { status: { _eq: 'active' } }] },
            limit: 1,
        })
    ).then(r => r.data);

    const client = clients?.[0];
    const loan   = loans?.[0];
    const active = activeEnrollments?.[0] ?? null;

    if (!client) return fail(res, 'Client not found.');
    if (!loan || loan.clientId !== clientId) return fail(res, 'Loan does not belong to this client.');
    // The disbursement modal only handles pending loans; approval flips them to 'active'.
    if (loan.status !== 'pending' || loan.ldfApproved === true) {
        return fail(res, 'Re-enrollment is only allowed while the loan is pending approval.');
    }
    const prevTemplate = parseTemplate(client.faceTemplate);
    if (!prevTemplate) return fail(res, 'This client has no face on record. Use the first-time enrollment instead.');

    // ── Gates (server-side; the modal's counter is only UX) ──────────────
    const prevEnrollmentId = active?._id ?? null;
    const mismatchWhere = { _and: [
        { client_id: { _eq: clientId } },
        { loan_id:   { _eq: loanId } },
        { matched:   { _eq: false } },
        prevEnrollmentId ? { enrollment_id: { _eq: prevEnrollmentId } } : { enrollment_id: { _is_null: true } },
    ] };
    const recaptureWhere = { _and: [
        { client_id: { _eq: clientId } },
        { loan_id:   { _eq: loanId } },
        { source:    { _eq: 'disbursement_recapture' } },
    ] };

    const { mismatchAgg, recaptureAgg, triggerAttempts } = await graph.query(
        aggregateQl(ATTEMPT_TYPE('mismatchAgg'), `aggregate { count }`, mismatchWhere),
        aggregateQl(ENROLLMENT_TYPE('recaptureAgg'), `aggregate { count }`, recaptureWhere),
        queryQl(ATTEMPT_TYPE('triggerAttempts'), { where: mismatchWhere, order_by: [{ captured_at: 'desc' }], limit: 1 })
    ).then(r => r.data);

    const mismatchCount  = mismatchAgg.aggregate.count;
    const recaptureCount = recaptureAgg.aggregate.count;

    if (mismatchCount < MIN_MISMATCHES_FOR_RECAPTURE) {
        return fail(res, `Re-enrollment unlocks after ${MIN_MISMATCHES_FOR_RECAPTURE} logged mismatches (found ${mismatchCount}). If you just tried, wait a moment and retry.`);
    }
    if (recaptureCount >= MAX_RECAPTURES_PER_LOAN) {
        return fail(res, 'The re-enrollment limit for this loan has been reached. Escalate to an administrator.');
    }

    // ── Evidence: how different is the new capture from the old reference? ──
    const distanceFromPrevious = euclid(faceTemplate, prevTemplate);
    if (distanceFromPrevious < FACE_MATCH_THRESHOLD) {
        return fail(res, 'This capture matches the existing face record. Retry verification instead of replacing it.', { code: 'ALREADY_MATCHES' });
    }

    const dup = await findDuplicateFace(faceTemplate, clientId);
    if (dup.available && dup.match) {
        return fail(res, 'This face matches another client on record. Re-enrollment blocked.', { code: 'DUPLICATE_FACE' });
    }
    const duplicateCheck = dup.available ? 'passed' : 'skipped';

    // ── Atomic swap: one request = one transaction ───────────────────────
    const now     = moment().toISOString();
    const newId   = generateUUID();
    const prevId  = active?._id ?? generateUUID();
    const prevVer = active?.version ?? 1;
    const trigger = triggerAttempts?.[0] ?? null;

    const ml = [];
    const add = (fn) => ml.push(fn(`bulk_${ml.length}`));

    if (active) {
        add(a => updateQl(ENROLLMENT_TYPE(a), {
            where: { _id: { _eq: active._id } },
            set:   { status: 'superseded', superseded_at: now },
        }));
    } else {
        // First recapture for a client with no version rows: snapshot the original reference as v1.
        add(a => insertQl(ENROLLMENT_TYPE(a), { objects: [{
            _id: prevId, client_id: clientId, version: 1, status: 'superseded', source: 'original',
            face_template: client.faceTemplate,
            photo_key: client.faceEnrollPhotoKey ?? null,
            liveness_score: client.livenessScore ?? null,
            enrolled_at: client.faceEnrolledAt ?? null,
            branch_id: client.branchId ?? null,
            superseded_at: now,
        }] }));
    }
    add(a => insertQl(ENROLLMENT_TYPE(a), { objects: [{
        _id: newId, client_id: clientId, version: prevVer + 1, status: 'active',
        source: 'disbursement_recapture',
        face_template: JSON.stringify(faceTemplate),
        photo_key: photoKey,
        liveness_score: liveness,
        enrolled_at: now,
        reason: reasonText,
        trigger_attempt_id: trigger?._id ?? null,
        loan_id: loanId,
        branch_id: client.branchId ?? null,
        captured_by: currentUser._id,
        approved_by: currentUser._id,
    }] }));
    add(a => updateQl(CLIENT_FACE_TYPE(a), {
        where: { _id: { _eq: clientId } },
        set: {
            faceTemplate: JSON.stringify(faceTemplate),
            faceEnrolledAt: now,
            faceEnrollPhotoKey: photoKey,
            livenessScore: liveness,
        },
    }));
    // Attempts logged before any version row existed belong to the reference being replaced.
    add(a => updateQl(ATTEMPT_TYPE(a), {
        where: { _and: [{ client_id: { _eq: clientId } }, { enrollment_id: { _is_null: true } }] },
        set: { enrollment_id: prevId },
    }));
    await graph.mutation(...ml);

    // Audit: no templates in here (biometric data + bloat) — keys and versions only.
    await logAudit(req, {
        action: 'CLIENT_FACE_RECAPTURED', category: 'BIOMETRIC', severity: 'WARNING',
        entityType: 'client', entityId: clientId, clientId,
        description: `Face reference re-enrolled (v${prevVer} → v${prevVer + 1}) for ${client.firstName} ${client.lastName} `
            + `by ${currentUser.firstName} ${currentUser.lastName}. Reason: ${reasonText}`,
        branchId: client.branchId,
        userId: currentUser._id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        beforeData: { version: prevVer, photoKey: client.faceEnrollPhotoKey ?? null, enrolledAt: client.faceEnrolledAt ?? null },
        afterData:  { version: prevVer + 1, photoKey },
        metadata: {
            clientId, loanId, ciReferenceCode: ciReferenceCode ?? loan.ciReferenceCode ?? null,
            reason: reasonText, mismatchCount, triggerAttemptId: trigger?._id ?? null,
            distanceFromPrevious: Number(distanceFromPrevious.toFixed(3)),
            duplicateCheck, approvedBy: currentUser._id, version: prevVer + 1,
        },
    });

    return res.status(200).json({
        success: true, version: prevVer + 1, enrollmentId: newId,
        distanceFromPrevious: Number(distanceFromPrevious.toFixed(3)),
    });
}