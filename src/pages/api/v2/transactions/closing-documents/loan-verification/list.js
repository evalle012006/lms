// src/pages/api/v2/transactions/closing-documents/loan-verification/list.js
// Paginated, batch-fetched review data for every loan approved
// (status: 'active', dateOfRelease === dateFor) on a v2 branch for a date.
// Read-only — acknowledge.js is the actual gate.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { LOAN_CLOSING_REVIEW_FIELDS, CI_INVESTIGATION_FIELDS, FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';
import { findBranches, resolveClientFlowStatus } from '@/lib/graph.functions';

const graph = new GraphProvider();

// Creators, not pre-aliased — called twice below (page + count) with
// different aliases, same pattern as face-verify-attempts/list.js.
const LOAN_TYPE = createGraphType('loans', `
    _id clientId fullName pnNumber principalLoan amountRelease groupName
    guarantorPhotoKey guarantorIdPhotoKey disbursementPhotoKey disbursementPhotoAt
    ciReferenceCode
`);

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName profile faceEnrollPhotoKey
    governmentIdType governmentIdPhotoKey selfieWithIdPhotoKey
`)('clients');

const CI_TYPE = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS)('attempts');
const REVIEW_TYPE = createGraphType('loan_closing_reviews', LOAN_CLOSING_REVIEW_FIELDS)('reviews');

export default apiHandler({ get: listLoanVerification });

async function listLoanVerification(req, res) {
    const { branchId, dateFor } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const offset = (page - 1) * limit;
    const authenticatedUserId = req.auth?.sub;

    if (!branchId || !dateFor) {
        return res.status(200).json({ success: false, message: 'branchId and dateFor are required.' });
    }

    try {
        const [branch] = await findBranches({ _id: { _eq: branchId } });

        // One settings query covers both: requireClientBiometric (affects
        // per-loan face-verify status below) and requireLoanVerificationAtClosing
        // (the whole-feature kill switch, independent of clientFlowVersion —
        // see update-group-transaction-status.js for why it's separate).
        const [settingsRow] = await graph.query(
            queryQl(createGraphType('settings', 'requireClientBiometric requireLoanVerificationAtClosing')('settings'), { limit: 1 })
        ).then(r => r.data?.settings ?? []);
        const requireClientBiometric = settingsRow?.requireClientBiometric ?? true;
        const loanVerificationEnabled = settingsRow?.requireLoanVerificationAtClosing ?? true;

        if (branch?.clientFlowVersion !== 'v2' || !loanVerificationEnabled) {
            return res.status(200).json({ success: true, applicable: false, loans: [], page, limit, total: 0, totalPages: 0 });
        }

        const loanWhere = {
            branchId: { _eq: branchId },
            dateOfRelease: { _eq: dateFor },
            status: { _eq: 'active' },
        };

        const { pageLoans, countAgg } = await graph.query(
            queryQl(LOAN_TYPE('pageLoans'), { where: loanWhere, order_by: [{ fullName: 'asc' }], limit, offset }),
            aggregateQl(LOAN_TYPE('countAgg'), `aggregate { count }`, loanWhere)
        ).then(r => r.data);

        const loans = pageLoans || [];
        const total = countAgg?.aggregate?.count || 0;

        if (loans.length === 0) {
            return res.status(200).json({ success: true, applicable: true, loans: [], page, limit, total, totalPages: Math.ceil(total / limit) });
        }

        // ── Batch-fetch everything this page needs — never per-loan ──────
        const loanIds = loans.map(l => l._id);
        const clientIds = [...new Set(loans.map(l => l.clientId).filter(Boolean))];
        const ciReferenceCodes = [...new Set(loans.map(l => l.ciReferenceCode).filter(Boolean))];

        const [clients, ciInvestigations, attempts, flowStatusMap, myReviews] = await Promise.all([
            clientIds.length
                ? graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _in: clientIds } } })).then(r => r.data?.clients ?? [])
                : [],
            ciReferenceCodes.length
                ? graph.query(queryQl(CI_TYPE, { where: { ciReferenceCode: { _in: ciReferenceCodes } } })).then(r => r.data?.ciInvestigations ?? [])
                : [],
            graph.query(queryQl(ATTEMPT_TYPE, {
                where: { loan_id: { _in: loanIds } },
                order_by: [{ captured_at: 'desc' }],
            })).then(r => r.data?.attempts ?? []),
            resolveClientFlowStatus(clientIds),
            authenticatedUserId
                ? graph.query(queryQl(REVIEW_TYPE, {
                    where: { branch_id: { _eq: branchId }, date_for: { _eq: dateFor }, loan_id: { _in: loanIds }, reviewed_by: { _eq: authenticatedUserId } },
                })).then(r => r.data?.reviews ?? [])
                : [],
        ]);

        const clientMap = Object.fromEntries(clients.map(c => [c._id, c]));
        const ciMap = Object.fromEntries(ciInvestigations.map(ci => [ci.ciReferenceCode, ci]));
        const reviewMap = Object.fromEntries(myReviews.map(r => [r.loan_id, r]));

        // attempts already newest-first — per loan, prefer the latest
        // matched one; fall back to the latest attempt of any kind.
        const attemptsByLoan = {};
        attempts.forEach(a => {
            if (!a.loan_id) return;
            if (!attemptsByLoan[a.loan_id]) attemptsByLoan[a.loan_id] = { latest: a, matched: null };
            if (a.matched && !attemptsByLoan[a.loan_id].matched) attemptsByLoan[a.loan_id].matched = a;
        });

        const shaped = loans.map(loan => {
            const client = clientMap[loan.clientId] || null;
            const ci = loan.ciReferenceCode ? (ciMap[loan.ciReferenceCode] || null) : null;
            const wentThroughNewFlow = flowStatusMap.hasOwnProperty(loan.clientId) ? flowStatusMap[loan.clientId] : true;
            const loanAttempts = attemptsByLoan[loan._id];

            let faceVerifyStatus, faceVerifyAttempt = null;
            if (!requireClientBiometric || !wentThroughNewFlow) {
                faceVerifyStatus = 'not_required';
            } else if (loanAttempts?.matched) {
                faceVerifyStatus = 'matched';
                faceVerifyAttempt = loanAttempts.matched;
            } else if (loanAttempts?.latest) {
                faceVerifyStatus = 'unmatched';
                faceVerifyAttempt = loanAttempts.latest;
            } else {
                faceVerifyStatus = 'missing';
            }

            const review = reviewMap[loan._id];

            return {
                loanId: loan._id,
                pnNumber: loan.pnNumber,
                principalLoan: loan.principalLoan,
                amountRelease: loan.amountRelease,
                groupName: loan.groupName,
                client: client ? {
                    id: client._id,
                    name: `${client.firstName} ${client.lastName}`,
                    profilePhotoKey: client.profile,
                    faceEnrollPhotoKey: client.faceEnrollPhotoKey,
                    governmentIdType: client.governmentIdType,
                    governmentIdPhotoKey: client.governmentIdPhotoKey,
                    selfieWithIdPhotoKey: client.selfieWithIdPhotoKey,
                } : null,
                documents: {
                    guarantorPhotoKey: loan.guarantorPhotoKey || null,
                    guarantorIdPhotoKey: loan.guarantorIdPhotoKey || null,
                    disbursementPhotoKey: loan.disbursementPhotoKey || null,
                    disbursementPhotoAt: loan.disbursementPhotoAt || null,
                },
                ci: loan.ciReferenceCode
                    ? { ciReferenceCode: loan.ciReferenceCode, found: !!ci, selfieKey: ci?.selfieKey || null, decision: ci?.decision || null, investigatedAt: ci?.investigatedAt || null, picUserName: ci?.picUserName || null }
                    : { ciReferenceCode: null, found: false },
                faceVerify: {
                    status: faceVerifyStatus, // matched | unmatched | missing | not_required
                    attempt: faceVerifyAttempt ? {
                        matched: faceVerifyAttempt.matched,
                        confidence: faceVerifyAttempt.confidence,
                        distance: faceVerifyAttempt.distance,
                        photoKey: faceVerifyAttempt.photo_key,
                        capturedAt: faceVerifyAttempt.captured_at,
                    } : null,
                },
                review: {
                    acknowledged: review?.acknowledged || false,
                    acknowledgedAt: review?.acknowledged_at || null,
                    viewCount: review?.view_count || 0,
                },
            };
        });

        return res.status(200).json({ success: true, applicable: true, loans: shaped, page, limit, total, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error listing loan verification data:', error.message);
        return res.status(200).json({ success: false, message: 'Error loading loan verification data.' });
    }
}