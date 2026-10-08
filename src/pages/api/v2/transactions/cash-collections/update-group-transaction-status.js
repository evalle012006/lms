import { CASH_COLLECTIONS_FIELDS, BRANCH_APPROVAL_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import moment from 'moment';
import { randomUUID } from 'crypto';
import logger from '@/logger';
import { notifyTransactionClosed, notifyBranchTransactionApproved, isNotificationEnabled } from '@/lib/notification-service';
import { findBranches, findUserById } from '@/lib/graph.functions';
// ADDED: shared list of required closing document types
import { CLOSING_DOC_KEYS } from '@/lib/closing-documents.constants';

// NOTE: there is intentionally NO module-level `response` / `statusCode` here.
// Next.js keeps this module alive across requests, so shared mutable state
// leaks results between concurrent requests. Every function below RETURNS a
// { status, body } result instead.

const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `_id`)('collections');
const BRANCH_APPROVAL_TYPE = createGraphType('branchApprovals', `_id`)('approvals');
const graph = new GraphProvider();

// Business-rule rejections have historically been returned as HTTP 200 with
// { error: true }. Kept as-is so the client behaves exactly as before.
// TODO: move to 409 once fetchWrapper's handling of non-2xx is confirmed.
const VALIDATION_STATUS = 200;

const MAX_LISTED = 5;       // names shown inline in the toast message
const MAX_LO_LOOKUPS = 20;  // cap on LO name lookups for one error response

// CHANGED: split from the old shared BRANCH_CLOSE_ALLOWED_SHORTCODES.
// Uploading documents and finalizing the close are now different
// permissions — BM can do the former, only AM+ can do the latter. Before
// this split, branch_manager was included in the list gating the actual
// mode:'close' mutation below, meaning a BM could self-approve their own
// branch closing via this same modal/endpoint with no AM involved at all —
// a real gap, not just a labeling issue, since the UI's "Pending AM
// Approval" state meant nothing if the underlying API still let BM finish
// the job themselves.
const BRANCH_FINAL_CLOSE_ALLOWED_SHORTCODES = [
    'admin', 'deputy_director', 'regional_manager', 'area_admin'
];

function isAuthorizedForBranchClose(role) {
    return !!role && BRANCH_FINAL_CLOSE_ALLOWED_SHORTCODES.includes(role.shortCode);
}

/* -------------------------------------------------------------------------- */
/* Result / error helpers                                                     */
/* -------------------------------------------------------------------------- */

const ok = (message) => ({ status: 200, body: { success: true, message } });

const fail = (status, code, message, extra = {}) => ({
    status,
    body: { error: true, code, message, ...extra },
});

function getRequestId(req) {
    const incoming = req.headers?.['x-request-id'];
    return typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
}

const shortRef = (requestId) => requestId.slice(0, 8);

/** Tags a thrown error with the step that failed so logs say WHERE, not just WHAT. */
async function step(name, fn) {
    try {
        return await fn();
    } catch (error) {
        if (error && !error.step) error.step = name;
        throw error;
    }
}

/** Hasura/GraphQL errors sometimes come back in the payload instead of throwing. */
function assertNoGraphErrors(result, label) {
    if (result?.errors?.length) {
        throw new Error(`${label}: ${result.errors.map(e => e.message).join('; ')}`);
    }
    return result;
}

/* -------------------------------------------------------------------------- */
/* Blocking-issue helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * labels  -> short human strings used in the toast message
 * details -> machine-readable payload for the UI (groups, loanOfficers, ...)
 */
function makeIssue(code, message, labels = [], details = {}) {
    return { code, message, labels, ...details };
}

function listLabels(labels) {
    if (!labels.length) return '';
    const shown = labels.slice(0, MAX_LISTED).join(', ');
    const rest = labels.length - MAX_LISTED;
    return rest > 0 ? `${shown} and ${rest} more` : shown;
}

function issueToText(issue) {
    const list = listLabels(issue.labels);
    return list ? `${issue.message} Affected: ${list}.` : issue.message;
}

/** All blocking issues at once — the user fixes everything in one pass instead of one error per click. */
function blockedResponse(issues) {
    return fail(VALIDATION_STATUS, issues[0].code, issues.map(issueToText).join(' '), { issues });
}

/**
 * A row from get_lo_transaction_summary is one group. gg.* supplies the group
 * columns; per-group collection stats live in cashCollections[0].
 */
function toGroupRef(cc, extra = {}) {
    const current = cc.cashCollections?.[0];
    return {
        groupId: cc._id,
        groupName: cc.name ?? cc.groupName ?? current?.groupName ?? null,
        ...extra,
    };
}

const groupLabel = (g) => g.groupName || g.groupId;

/* -------------------------------------------------------------------------- */
/* Entry points                                                               */
/* -------------------------------------------------------------------------- */

export default apiHandler({
    post: processGroupTransactionStatus,
    get: getLOSummary
});

async function processGroupTransactionStatus(req, res) {
    const requestId = getRequestId(req);
    const body = req.body ?? {};
    const { loId, branchId, mode, currentDate } = body;
    const ctx = { requestId, mode, loId, branchId, currentDate, actorId: req.auth?.sub };

    let result;
    try {
        result = await dispatchStatusChange(req, body, requestId);
    } catch (error) {
        logger.error({
            event: 'update-group-transaction-status.exception',
            ...ctx,
            step: error.step ?? 'unknown',
            error: error.message,
            stack: error.stack,
        });
        const target = !!branchId && !loId ? 'branch approval' : 'Loan Officer transactions';
        result = fail(
            500,
            'INTERNAL_ERROR',
            `Error processing ${target}. Please try again or report reference ${shortRef(requestId)}.`,
            { step: error.step ?? 'unknown' }
        );
    }

    if (result.body.error) {
        logger.warn({
            event: 'update-group-transaction-status.rejected',
            ...ctx,
            httpStatus: result.status,
            code: result.body.code,
            issueCodes: result.body.issues?.map(i => i.code),
        });
        result.body.context = { loId, branchId, mode, date: currentDate };
    }
    result.body.requestId = requestId;

    res.status(result.status)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(result.body));
}

async function dispatchStatusChange(req, body, requestId) {
    const { loId, branchId, mode, currentDate, currentTime, transactionType, userId, userName, isAdmin } = body;

    // ADDED: previously any unrecognised/missing mode silently fell through
    // to the "open" (reopen) path.
    if (mode !== 'open' && mode !== 'close') {
        return fail(400, 'INVALID_MODE', "Mode must be either 'open' or 'close'.");
    }
    if (!currentDate) {
        return fail(400, 'MISSING_DATE', 'Transaction date is required.');
    }

    // Determine if this is a branch-level or LO-level operation
    const isBranchLevel = !!branchId && !loId;
    const isNotificationEnabledFlag = await isNotificationEnabled();

    if (isBranchLevel) {
        // ADDED: authoritative server-side role check, using the
        // authenticated session (req.auth.sub) — not req.body.userId, which
        // is client-supplied and could name any user regardless of who's
        // actually logged in.
        const requestingUser = await step('find-requesting-user', () => findUserById(req.auth?.sub));
        if (!isAuthorizedForBranchClose(requestingUser?.role)) {
            return fail(403, 'FORBIDDEN', 'You are not authorized to open or close branch transactions.');
        }
        return processBranchApproval({
            branchId, dateFor: currentDate, mode, userId, userName,
            isAdmin: !!isAdmin, isNotificationEnabledFlag,
        });
    }

    if (loId) {
        return processLOApproval({
            loId, branchId, currentDate, currentTime, mode, transactionType,
            isAdmin: !!isAdmin, isNotificationEnabledFlag, userName,
        });
    }

    return fail(400, 'MISSING_TARGET', 'Either Branch ID or Loan Officer ID is required.');
}

/* -------------------------------------------------------------------------- */
/* Branch-level                                                               */
/* -------------------------------------------------------------------------- */

async function processBranchApproval({ branchId, dateFor, mode, userId, userName, isAdmin, isNotificationEnabledFlag }) {
    // Before closing, verify the branch is ready. Admins bypass this.
    if (mode === 'close' && !isAdmin) {
        const issues = await collectBranchBlockingIssues(branchId, dateFor, userId);
        if (issues.length > 0) {
            return blockedResponse(issues);
        }
    }

    const approvalResult = await step('update-branch-approval', () =>
        handleBranchApproval(branchId, dateFor, mode, userId, userName)
    );

    if (!approvalResult.success) {
        return fail(400, approvalResult.code ?? 'BRANCH_APPROVAL_FAILED', approvalResult.message);
    }

    // Create notification for branch approval
    if (isNotificationEnabledFlag && mode === 'close') {
        try {
            const branches = await findBranches({ _id: { _eq: branchId } });
            const branch = branches?.[0];

            if (branch) {
                await notifyBranchTransactionApproved({
                    branchName: branch.name,
                    branchId: branchId,
                    date: dateFor,
                    areaId: branch.areaId,
                    regionId: branch.regionId,
                    divisionId: branch.divisionId,
                    createdBy: userId,
                    createdByName: userName
                });
            }
        } catch (notifError) {
            logger.error({
                event: 'update-group-transaction-status.notify-branch-failed',
                branchId, date: dateFor, error: notifError.message,
            });
        }
    }

    const actionText = mode === 'close' ? 'locked and approved' : 'unlocked';
    const adminNote = isAdmin ? ' (Admin override)' : '';
    return ok(`Branch has been ${actionText} successfully.${adminNote}`);
}

/**
 * Runs every branch-close precondition and returns ALL failures, not just the first.
 * Order matches the previous first-failure order.
 */
async function collectBranchBlockingIssues(branchId, dateFor, userId) {
    const issues = [];

    // 1. All LO transactions closed
    const unclosed = await step('check-unclosed-lo-transactions', () => checkBranchTransactionStatus(branchId, dateFor));
    if (unclosed.length > 0) {
        const loanOfficers = await describeUnclosedByLo(unclosed);
        issues.push(makeIssue(
            'UNCLOSED_LO_TRANSACTIONS',
            'Cannot approve branch. Some Loan Officers still have open or pending transactions. All LO transactions must be closed first.',
            loanOfficers.map(lo => `${lo.loName ?? lo.loId} — ${lo.groups.map(groupLabel).join(', ')}`),
            { loanOfficers }
        ));
    }

    // 2. ADDED: Cash on Hand must be recorded for this branch/date before closing.
    const hasCOHRecord = await step('check-branch-coh', () => branchCOHRecordExists(branchId, dateFor));
    if (!hasCOHRecord) {
        issues.push(makeIssue(
            'COH_NOT_RECORDED',
            'Cannot approve branch. Cash on Hand has not been recorded for today. Please save Cash on Hand before closing.'
        ));
    }

    // 3. FIXED: Check for pending fund transfers at branch level
    const pendingFundTransfers = await step('check-branch-fund-transfers', () => checkBranchFundTransfers(branchId, dateFor));
    if (pendingFundTransfers.length > 0) {
        issues.push(makeIssue(
            'PENDING_FUND_TRANSFERS',
            'Cannot approve branch. There are pending Fund Transfers. Please check and approve or contact Finance Admin.',
            [`${pendingFundTransfers.length} transfer(s)`],
            { transfers: pendingFundTransfers.map(summarizeTransfer) }
        ));
    }

    // 4. ADDED: Require all branch closing documents before allowing close.
    // Client-side (branch-check.js) enforces this too for UX, but this is
    // the authoritative server-side gate — never trust the client alone.
    const missingDocTypes = await step('check-missing-closing-documents', () => checkMissingClosingDocuments(branchId, dateFor));
    if (missingDocTypes.length > 0) {
        issues.push(makeIssue(
            'MISSING_CLOSING_DOCUMENTS',
            'Cannot approve branch. Missing closing documents.',
            missingDocTypes,
            { docTypes: missingDocTypes }
        ));
    } else {
        // 5. ADDED: require all documents to be acknowledged BY THE PERSON
        // FINALIZING (userId), matched to their currently active version.
        // Skipped when documents are missing — that check would just repeat it.
        const unacknowledgedDocTypes = await step('check-unacknowledged-closing-documents', () =>
            checkUnacknowledgedClosingDocuments(branchId, dateFor, userId)
        );
        if (unacknowledgedDocTypes.length > 0) {
            issues.push(makeIssue(
                'UNACKNOWLEDGED_CLOSING_DOCUMENTS',
                'Cannot approve branch. You must review and acknowledge the closing documents.',
                unacknowledgedDocTypes,
                { docTypes: unacknowledgedDocTypes }
            ));
        }
    }

    // 6. ADDED: v2 branches must have every loan approved today (status:
    // 'active', dateOfRelease: today) reviewed and acknowledged by the
    // person finalizing. Non-v2 branches skip this entirely, and so does
    // every branch when settings.requireLoanVerificationAtClosing is off —
    // a deliberate separate switch from clientFlowVersion, since that flag
    // also governs CI enforcement, guarantor docs, etc. for the branch and
    // shouldn't have to be touched just to disable this one step.
    const branchForVerification = await step('find-branch-for-verification', () => findBranches({ _id: { _eq: branchId } }));
    const loanVerificationEnabled = await step('check-loan-verification-enabled', () => isLoanVerificationEnabled());
    if (branchForVerification?.[0]?.clientFlowVersion === 'v2' && loanVerificationEnabled) {
        const unreviewedLoanIds = await step('check-unreviewed-loans', () =>
            checkUnreviewedLoans(branchId, dateFor, userId)
        );
        if (unreviewedLoanIds.length > 0) {
            issues.push(makeIssue(
                'UNREVIEWED_LOANS',
                'Cannot approve branch. Some approved loans still need loan verification review.',
                [`${unreviewedLoanIds.length} loan(s)`],
                { loanIds: unreviewedLoanIds }
            ));
        }
    }

    return issues;
}

/** Collapses unclosed cash-collection rows into [{ loId, loName, groups: [...] }]. */
async function describeUnclosedByLo(unclosed) {
    const byLo = new Map();
    for (const cc of unclosed) {
        if (!byLo.has(cc.loId)) byLo.set(cc.loId, new Map());
        byLo.get(cc.loId).set(cc.groupId, {
            groupId: cc.groupId,
            groupName: cc.groupName ?? null,
            groupStatus: cc.groupStatus,
        });
    }

    const loIds = [...byLo.keys()];
    const names = new Map();
    await Promise.all(
        loIds.slice(0, MAX_LO_LOOKUPS).map(async (id) => {
            try {
                const user = await findUserById(id);
                if (user) names.set(id, `${user.firstName} ${user.lastName}`);
            } catch (e) {
                // Name lookup is best-effort; never let it mask the real error.
            }
        })
    );

    return loIds.map(id => ({
        loId: id,
        loName: names.get(id) ?? null,
        groups: [...byLo.get(id).values()],
    }));
}

const summarizeTransfer = (t) => ({
    transferId: t._id,
    status: t.status,
    giverApprovalStatus: t.giverApprovalStatus,
    receiverApprovalStatus: t.receiverApprovalStatus,
});

async function resetClosingDocumentAcknowledgments(branchId, dateFor) {
    return graph.mutation(
        updateQl(
            createGraphType('closing_document_reviews', `_id`)('reviews'),
            {
                set: {
                    acknowledged: false,
                    acknowledged_at: null,
                },
                where: {
                    branch_id: { _eq: branchId },
                    date_for: { _eq: dateFor },
                    acknowledged: { _eq: true },
                },
            },
        ),
    );
}

/**
 * ADDED: same reset as resetClosingDocumentAcknowledgments, for the loan
 * verification step. Called from the same two places — an LO reopen or a
 * direct branch-level reopen invalidates a prior AM sign-off on the day's
 * approved loans just as much as it invalidates document sign-offs.
 */
async function resetLoanClosingReviewAcknowledgments(branchId, dateFor) {
    return graph.mutation(
        updateQl(
            createGraphType('loan_closing_reviews', `_id`)('reviews'),
            {
                set: {
                    acknowledged: false,
                    acknowledged_at: null,
                },
                where: {
                    branch_id: { _eq: branchId },
                    date_for: { _eq: dateFor },
                    acknowledged: { _eq: true },
                },
            },
        ),
    );
}

// CHANGED: no internal try/catch any more. It used to swallow every failure
// into a generic "Error processing branch approval." with no context. Errors
// now propagate to processGroupTransactionStatus, which logs the step,
// branchId and requestId.
async function handleBranchApproval(branchId, dateFor, mode, userId, userName) {
    // Check if approval record exists for this branch and date
    const existingApproval = await graph.query(
        queryQl(
            createGraphType('branchApprovals', `${BRANCH_APPROVAL_FIELDS}`)('approvals'),
            {
                where: {
                    branchId: { _eq: branchId },
                    dateFor: { _eq: dateFor }
                }
            }
        )
    );

    const approval = existingApproval.data.approvals[0];

    if (mode === 'close') {
        if (approval) {
            // Update existing record
            const result = assertNoGraphErrors(await graph.mutation(
                updateQl(
                    BRANCH_APPROVAL_TYPE,
                    {
                        set: {
                            status: 'closed',
                            userId: userId,
                            userName: userName,
                            dateModified: new Date().toISOString(),
                            // ADDED: clear any stale flag on a fresh/re-close —
                            // documents were just validated as complete above.
                            documentsStale: false,
                            staleReason: null,
                            staleAt: null
                        },
                        where: {
                            _id: { _eq: approval._id }
                        }
                    }
                )
            ), 'update branch approval (close)');

            if (result.data.approvals.affected_rows > 0) {
                return { success: true };
            }
            return { error: true, code: 'BRANCH_APPROVAL_UPDATE_FAILED', message: "Failed to update branch approval." };
        }

        // Create new record
        const result = assertNoGraphErrors(await graph.mutation(
            insertQl(
                BRANCH_APPROVAL_TYPE,
                {
                    objects: [{
                        branchId: branchId,
                        userId: userId,
                        userName: userName,
                        status: 'closed',
                        dateFor: dateFor,
                        dateAdded: new Date().toISOString(),
                        // ADDED
                        documentsStale: false,
                        staleReason: null,
                        staleAt: null
                    }]
                }
            )
        ), 'insert branch approval (close)');

        if (result.data.approvals.affected_rows > 0) {
            return { success: true };
        }
        return { error: true, code: 'BRANCH_APPROVAL_CREATE_FAILED', message: "Failed to create branch approval." };
    }

    // mode === 'open'
    // ADDED: was this branch previously closed? Only matters in
    // that case — reopening an already-open branch has nothing to
    // reset. Captured before the update below overwrites status.
    const wasClosed = approval?.status === 'closed';

    if (approval) {
        // Update existing record
        const result = assertNoGraphErrors(await graph.mutation(
            updateQl(
                BRANCH_APPROVAL_TYPE,
                {
                    set: {
                        status: 'open',
                        userId: userId,
                        userName: userName,
                        dateModified: new Date().toISOString()
                    },
                    where: {
                        _id: { _eq: approval._id }
                    }
                }
            )
        ), 'update branch approval (open)');

        if (result.data.approvals.affected_rows > 0) {
            // ADDED: same reset as the LO-level reopen path — a direct
            // branch-level reopen is at least as consequential as reopening
            // a single LO, so it must invalidate prior acknowledgments too.
            // Previously this path had no reset at all, meaning re-closing
            // after a full branch reopen would silently reuse stale sign-offs.
            if (wasClosed) {
                await resetClosingDocumentAcknowledgments(branchId, dateFor);
                // ADDED: same reset for loan verification reviews.
                await resetLoanClosingReviewAcknowledgments(branchId, dateFor);
            }
            return { success: true };
        }
        return { error: true, code: 'BRANCH_APPROVAL_UPDATE_FAILED', message: "Failed to update branch approval." };
    }

    // Create new record with 'open' status
    const result = assertNoGraphErrors(await graph.mutation(
        insertQl(
            BRANCH_APPROVAL_TYPE,
            {
                objects: [{
                    branchId: branchId,
                    userId: userId,
                    userName: userName,
                    status: 'open',
                    dateFor: dateFor,
                    dateAdded: new Date().toISOString()
                }]
            }
        )
    ), 'insert branch approval (open)');

    if (result.data.approvals.affected_rows > 0) {
        return { success: true };
    }
    return { error: true, code: 'BRANCH_APPROVAL_CREATE_FAILED', message: "Failed to create branch approval." };
}

/* -------------------------------------------------------------------------- */
/* LO-level                                                                   */
/* -------------------------------------------------------------------------- */

async function processLOApproval({ loId, branchId, currentDate, currentTime, mode, transactionType, isAdmin, isNotificationEnabledFlag, userName }) {
    const dayName = moment(currentDate).format('dddd').toLowerCase();
    const cashCollectionCounts = await step('get_lo_transaction_summary', () =>
        checkLoTransactions(loId, currentDate, dayName, transactionType)
    );

    if (!cashCollectionCounts) {
        return fail(500, 'LO_SUMMARY_UNAVAILABLE', 'Error checking Loan Officer transactions.');
    }

    // Only run these validations if NOT admin
    if (!isAdmin && mode === 'close') {
        const issues = await collectLoBlockingIssues(cashCollectionCounts, branchId, currentDate);
        if (issues.length > 0) {
            return blockedResponse(issues);
        }
    }

    // CHANGED: the old code had two mutations chosen by
    // `mode === 'close' && hasClosingTime.length === 0`, but both branches
    // produced the identical update for every input (close => closed +
    // currentTime, open => pending + null), so they are collapsed into one.
    const updateResult = assertNoGraphErrors(
        await step('update-cash-collections', () =>
            graph.mutation(
                updateQl(CASH_COLLECTION_TYPE, {
                    set: {
                        groupStatus: mode === 'close' ? 'closed' : 'pending',
                        closingTime: mode === 'close' ? currentTime : null,
                    },
                    where: {
                        loId: { _eq: loId },
                        dateAdded: { _eq: currentDate }
                    }
                })
            )
        ),
        'update cash collections'
    );

    if (updateResult.data.collections.affected_rows === 0) {
        return fail(VALIDATION_STATUS, 'NO_TRANSACTIONS_FOUND', 'No transactions found for this Loan Officer.');
    }

    // ADDED: If an LO transaction is reopened after the branch was already
    // closed for this date, flag the branch's uploaded closing documents as
    // stale rather than touching branchApprovals.status.
    if (mode === 'open' && branchId) {
        await flagBranchDocumentsStale(branchId, currentDate, loId, userName);
    }

    // Create notification for LO transaction close
    if (isNotificationEnabledFlag && mode === 'close') {
        try {
            const user = await findUserById(loId);
            const branches = await findBranches({ _id: { _eq: branchId } });
            const branch = branches?.[0];

            if (user && branch) {
                await notifyTransactionClosed({
                    loName: `${user.firstName} ${user.lastName}`,
                    loId: loId,
                    date: currentDate,
                    branchId: branchId,
                    areaId: branch.areaId,
                    regionId: branch.regionId,
                    divisionId: branch.divisionId,
                    createdBy: loId,
                    createdByName: `${user.firstName} ${user.lastName}`
                });
            }
        } catch (notifError) {
            logger.error({
                event: 'update-group-transaction-status.notify-lo-failed',
                loId, branchId, date: currentDate, error: notifError.message,
            });
        }
    }

    const adminNote = isAdmin ? ' (Admin override)' : '';
    return ok(`Transactions updated successfully.${adminNote}`);
}

/**
 * Evaluates every LO-close precondition per group and returns ALL failures.
 * Blocking conditions are identical to the previous first-failure chain; only
 * the reporting changed (all issues, each naming the offending groups).
 */
async function collectLoBlockingIssues(cashCollectionCounts, branchId, currentDate) {
    const issues = [];
    const current = (cc) => cc.cashCollections?.[0];

    const noCollections = cashCollectionCounts.filter(cc => cc.cashCollections.length === 0);
    const hasDrafts = cashCollectionCounts.filter(cc => current(cc) && current(cc).hasDrafts > 0);
    const hasPendingMcbuWithdrawals = cashCollectionCounts.filter(cc => cc.mcbuw_count > 0);
    const hasPendingFundTransfers = cashCollectionCounts.filter(cc => cc.ft_count > 0);
    const hasPendingDenominations = cashCollectionCounts.filter(cc => cc.denom_count > 0);
    const hasPendingLoans = cashCollectionCounts.filter(cc => cc.pending_count > 0);

    // Groups with money collected but no denomination entry. A group with
    // denom === 0 is only an offender if it also passes the "valid no
    // denomination" test (it collected money and has a partial mispayment
    // mix). Same semantics as the old set-intersection check, but it now
    // reports which groups.
    const isValidNoDenomination = (cc) => {
        const cur = current(cc);
        const totalNetCollection = cur ? cur.totalNetCollection : 0;
        const tda = cur ? cur.tda : 0;
        const goodExcused = cur ? cur.goodExcused : 0;
        const pastDue = cur ? cur.pastDue : 0;
        const maturedPd = cur ? cur.maturedPd : 0;
        const mispayments = cur ? cur.mispayments + tda + goodExcused + maturedPd + pastDue : 0;
        return cc.denom === 0
            && cc.cashCollections.length > 0
            && cur.count > 0
            && mispayments > 0
            && cur.count !== mispayments
            && totalNetCollection > 0;
    };
    const noDenominationOffenders = cashCollectionCounts.filter(cc => cc.denom === 0 && isValidNoDenomination(cc));

    // Fund transfers are branch-wide (ft_count repeats on every group row), so
    // list the actual transfers instead of every group.
    const fundTransferBranchId = branchId || cashCollectionCounts[0]?.branchId;
    let pendingTransfers = [];
    if (fundTransferBranchId) {
        pendingTransfers = await step('check-branch-fund-transfers', () =>
            checkBranchFundTransfers(fundTransferBranchId, currentDate)
        );
    }

    const addGroupIssue = (code, message, rows, extraFor = () => ({})) => {
        if (rows.length === 0) return;
        const groups = rows.map(cc => toGroupRef(cc, extraFor(cc)));
        issues.push(makeIssue(code, message, groups.map(groupLabel), { groups }));
    };

    addGroupIssue(
        'NO_CURRENT_TRANSACTIONS',
        'Some groups have no current transactions for the selected Loan Officer.',
        noCollections
    );
    addGroupIssue(
        'DRAFT_TRANSACTIONS',
        'Some groups have draft transactions for the selected Loan Officer.',
        hasDrafts,
        (cc) => ({ count: current(cc).hasDrafts })
    );
    addGroupIssue(
        'PENDING_MCBU_WITHDRAWALS',
        'Some groups have pending MCBU withdrawals for the selected Loan Officer. Please reject or delete them.',
        hasPendingMcbuWithdrawals,
        (cc) => ({ count: cc.mcbuw_count })
    );

    if (pendingTransfers.length > 0 || hasPendingFundTransfers.length > 0) {
        issues.push(makeIssue(
            'PENDING_FUND_TRANSFERS',
            'Branch has pending Fund Transfer(s). Please check and approve or contact Finance Admin.',
            [],
            {
                branchId: fundTransferBranchId ?? null,
                transfers: pendingTransfers.map(summarizeTransfer),
            }
        ));
    }

    addGroupIssue(
        'NO_DENOMINATION',
        'LO has no Denomination entries. Please check and add them.',
        noDenominationOffenders
    );
    addGroupIssue(
        'PENDING_DENOMINATIONS',
        'LO has pending or not balanced Denomination entries. Please check and approve or contact Cashier.',
        hasPendingDenominations,
        (cc) => ({ count: cc.denom_count })
    );
    addGroupIssue(
        'PENDING_LOANS',
        'LO has pending Loan entries. Please check and approve or contact Branch Manager.',
        hasPendingLoans,
        (cc) => ({ count: cc.pending_count })
    );

    return issues;
}

/* -------------------------------------------------------------------------- */
/* Data access                                                                */
/* -------------------------------------------------------------------------- */

// CHANGED: helper try/catch blocks that only logged-and-rethrew are gone —
// callers wrap these in step(), so the failure is logged once, with context.

async function checkBranchTransactionStatus(branchId, currentDate) {
    // Get all cash collections for this branch that are NOT closed
    const unclosedCollections = await graph.query(
        queryQl(
            createGraphType('cashCollections', `
                _id
                loId
                groupId
                groupName
                groupStatus
            `)('cashCollections'),
            {
                where: {
                    branchId: { _eq: branchId },
                    dateAdded: { _eq: currentDate },
                    groupStatus: { _neq: "closed" }
                }
            }
        )
    );

    return unclosedCollections.data?.cashCollections || [];
}

/**
 * FIXED: New function to check for pending fund transfers at branch level
 * This provides a comprehensive check for all fund transfer scenarios
 */
async function checkBranchFundTransfers(branchId, currentDate) {
    const pendingTransfers = await graph.query(
        queryQl(
            createGraphType('fund_transfer', `
                _id
                giverBranchId
                receiverBranchId
                status
                giverApprovalStatus
                receiverApprovalStatus
                amount
            `)('fundTransfers'),
            {
                where: {
                    _and: [
                        {
                            _or: [
                                { giverBranchId: { _eq: branchId } },
                                { receiverBranchId: { _eq: branchId } }
                            ]
                        },
                        { insertedDate: { _eq: currentDate } },
                        { deleted: { _eq: false } },
                        {
                            _or: [
                                { status: { _eq: 'pending' } },
                                { giverApprovalStatus: { _eq: 'pending' } },
                                { receiverApprovalStatus: { _eq: 'pending' } }
                            ]
                        }
                    ]
                }
            }
        )
    );

    const transfers = pendingTransfers.data?.fundTransfers || [];

    if (transfers.length > 0) {
        logger.debug({
            event: 'update-group-transaction-status.pending-fund-transfers',
            branchId,
            date: currentDate,
            transfers: transfers.map(summarizeTransfer),
        });
    }

    return transfers;
}

/**
 * ADDED: Returns the doc types from CLOSING_DOC_KEYS that do NOT have an
 * active (isActive: true) row for this branch/date. Empty array = complete.
 */
async function checkMissingClosingDocuments(branchId, dateFor) {
    const result = await graph.query(
        queryQl(
            createGraphType('closing_documents', `doc_type`)('closingDocuments'),
            {
                where: {
                    branch_id: { _eq: branchId },
                    date_for: { _eq: dateFor },
                    is_active: { _eq: true }
                }
            }
        )
    );

    const uploadedTypes = (result?.data?.closingDocuments || []).map(d => d.doc_type);
    return CLOSING_DOC_KEYS.filter(k => !uploadedTypes.includes(k));
}

/**
 * ADDED: Returns the doc types not yet acknowledged BY THIS SPECIFIC
 * USER, matched against each document's currently active version — a
 * re-upload bumps the version and correctly un-acknowledges it, since
 * the old review row simply won't match anymore.
 */
async function checkUnacknowledgedClosingDocuments(branchId, dateFor, userId) {
    const activeDocs = await graph.query(
        queryQl(
            createGraphType('closing_documents', `doc_type version`)('closingDocuments'),
            {
                where: {
                    branch_id: { _eq: branchId },
                    date_for: { _eq: dateFor },
                    is_active: { _eq: true },
                },
            },
        ),
    );
    const docs = activeDocs?.data?.closingDocuments || [];
    if (docs.length === 0) return CLOSING_DOC_KEYS; // nothing uploaded — handled by the earlier check, but be safe

    const reviews = await graph.query(
        queryQl(
            createGraphType('closing_document_reviews', `doc_type version acknowledged`)('reviews'),
            {
                where: {
                    branch_id: { _eq: branchId },
                    date_for: { _eq: dateFor },
                    reviewed_by: { _eq: userId },
                    acknowledged: { _eq: true },
                },
            },
        ),
    );
    const acknowledgedRows = reviews?.data?.reviews || [];

    return docs
        .filter(doc => !acknowledgedRows.some(r => r.doc_type === doc.doc_type && r.version === doc.version))
        .map(doc => doc.doc_type);
}

/**
 * ADDED: v2-branch loan verification gate. Returns loan _ids for loans
 * approved today (status: 'active', dateOfRelease: dateFor) that this
 * user has not yet acknowledged in loan_closing_reviews. Empty array =
 * complete. Mirrors checkUnacknowledgedClosingDocuments in shape.
 */
async function checkUnreviewedLoans(branchId, dateFor, userId) {
    const approvedLoans = await graph.query(
        queryQl(
            createGraphType('loans', `_id`)('loans'),
            {
                where: {
                    branchId: { _eq: branchId },
                    dateOfRelease: { _eq: dateFor },
                    status: { _eq: 'active' },
                },
            },
        ),
    );
    const loanIds = (approvedLoans?.data?.loans || []).map(l => l._id);
    if (loanIds.length === 0) return [];

    const reviews = await graph.query(
        queryQl(
            createGraphType('loan_closing_reviews', `loan_id`)('reviews'),
            {
                where: {
                    branch_id: { _eq: branchId },
                    date_for: { _eq: dateFor },
                    reviewed_by: { _eq: userId },
                    acknowledged: { _eq: true },
                    loan_id: { _in: loanIds },
                },
            },
        ),
    );
    const acknowledgedLoanIds = new Set((reviews?.data?.reviews || []).map(r => r.loan_id));

    return loanIds.filter(id => !acknowledgedLoanIds.has(id));
}

/**
 * Returns true if a branchCOH row exists for this branch/date.
 * Existence alone is the gate here — amount validity (>=0) is enforced
 * at save time in save-update-coh.js, not re-validated here.
 */
async function branchCOHRecordExists(branchId, dateFor) {
    const result = await graph.query(
        queryQl(
            createGraphType('branchCOH', `_id`)('cohRecords'),
            {
                where: {
                    branchId: { _eq: branchId },
                    dateAdded: { _eq: dateFor },
                },
            },
        ),
    );
    return (result?.data?.cohRecords || []).length > 0;
}

/**
 * ADDED: Flags an already-closed branch's approval row as stale when one of
 * its LO transactions is reopened. status is left untouched ('closed' stays
 * 'closed') — this is purely advisory, surfaced on the dashboard.
 */
async function flagBranchDocumentsStale(branchId, currentDate, loId, reopenedByName) {
    try {
        const existingApproval = await graph.query(
            queryQl(
                createGraphType('branchApprovals', `_id status`)('approvals'),
                {
                    where: {
                        branchId: { _eq: branchId },
                        dateFor: { _eq: currentDate },
                        status: { _eq: 'closed' }
                    }
                }
            )
        );

        const approval = existingApproval?.data?.approvals?.[0];
        if (!approval) return; // branch was never closed for this date — nothing to flag

        const lo = await findUserById(loId);

        await graph.mutation(
            updateQl(BRANCH_APPROVAL_TYPE, {
                set: {
                    status: 'open',
                    documentsStale: true,
                    // FIXED: was JSON.stringify(...) — that pre-serializes
                    // the object into a string, and the jsonb column then
                    // stores that string AS the JSON value (a valid but
                    // wrong shape: a JSON scalar string, not an object).
                    // Every future read of staleReason.loName etc. would
                    // silently get undefined. Pass the object directly —
                    // Hasura's jsonb input handles serialization itself.
                    staleReason: {
                        loId,
                        loName: lo ? `${lo.firstName} ${lo.lastName}` : null,
                        reopenedBy: reopenedByName || null,
                        reopenedAt: new Date().toISOString()
                    },
                    staleAt: new Date().toISOString()
                },
                where: { _id: { _eq: approval._id } }
            })
        );

        // ADDED: the badge alone was cosmetic — nothing was actually
        // invalidating AM's prior acknowledgments. checkUnacknowledgedClosingDocuments
        // matches on (doc_type, version), and an LO reopen changes neither,
        // so the finalize gate would silently pass a second time on data
        // that was never re-reviewed. Reset every review row for this
        // branch/date to unacknowledged regardless of version — the thing
        // that went stale is "AM's confirmation these numbers were correct,"
        // not the files themselves, so acknowledgment is what must reset.
        await resetClosingDocumentAcknowledgments(branchId, currentDate);
        // ADDED: same reset for loan verification reviews — an LO reopen
        // means the day's numbers may change, so AM's prior per-loan
        // sign-offs can no longer be trusted either.
        await resetLoanClosingReviewAcknowledgments(branchId, currentDate);
    } catch (error) {
        // Don't fail the LO reopen just because the stale-flag write failed —
        // log and move on, but this is worth alerting on if it happens often.
        logger.error({
            event: 'update-group-transaction-status.flag-stale-failed',
            branchId, loId, date: currentDate, error: error.message, stack: error.stack,
        });
    }
}

async function checkLoTransactions(loId, currentDate, dayName, transactionType) {
    const collections = await graph.apollo.query({
        query: gql`
            query groups ($where: loan_group_model_bool_exp_bool_exp, $args: get_lo_transaction_summary_arguments!) {
                collections: get_lo_transaction_summary(args: $args, where: $where) {
                    _id,
                    data
                }
            }
        `,
        variables: {
            args: {
                loId,
                dateAdded: currentDate,
                dayName: dayName,
                transactionType: transactionType,
            }
        }
    })
    .then(res => res.data.collections.map(c => c.data));

    return collections;
}

async function getLOSummary(req, res) {
    const { groupIds, currentDate } = req.query;

    // ADDED: split(',') on undefined used to throw an opaque TypeError.
    if (!groupIds || !currentDate) {
        return res.status(400)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, code: 'MISSING_PARAMS', message: 'groupIds and currentDate are required.' }));
    }

    const ids = groupIds.split(',');

    const groups = await graph.query(
        queryQl(createGraphType('cashCollections', `${CASH_COLLECTIONS_FIELDS}`)('collections'), {
            where: {
                groupId: { _in: ids },
                dateAdded: { _eq: currentDate }
            }
        })
    ).then(res => res.data.collections);

    // CHANGED: was using the shared module-level statusCode, which could be
    // stuck on a previous request's 400/403/500.
    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, data: groups }));
}

/**
 * ADDED: global kill switch for the loan verification closing step,
 * independent of clientFlowVersion (settings.requireLoanVerificationAtClosing).
 * Defaults to true (enabled) when unset — same default posture as
 * requireClientBiometric.
 */
async function isLoanVerificationEnabled() {
    const result = await graph.query(
        queryQl(createGraphType('settings', 'requireLoanVerificationAtClosing')('settings'), { limit: 1 })
    );
    return result?.data?.settings?.[0]?.requireLoanVerificationAtClosing ?? true;
}