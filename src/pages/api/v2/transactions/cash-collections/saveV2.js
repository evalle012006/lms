/**
 * saveV2.js - Enhanced Cash Collection Save API
 * 
 * This is a wrapper around the original save logic that adds:
 * 1. Date validation (prevents midnight crossover issues)
 * 2. Retry mechanism (handles intermittent failures)
 * 3. Better error logging
 * 4. Notifications for offset transactions
 * 
 * The core save logic remains unchanged from the original save.js
 */

import { CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, DENOMINATION_FIELDS, GROUP_FIELDS, LOAN_FIELDS, QR_CASH_COLLECTION_ENTRY_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID, safeNumber } from '@/lib/utils';
import logger from '@/logger';
import { logAudit } from '@/lib/audit';
import { buildLorAuditEvents, MAX_LOR_EVENTS } from '@/lib/audit-lor';
import { apiHandler } from '@/services/api-handler';
import { savePendingLoans } from './update-pending-loans';
import { findGroups, findUserById, findBranches } from '@/lib/graph.functions';
import { notifyLoanOffset, notifySuccessiveDelinquent, notifyDelinquentAsReloaner, isNotificationEnabled } from '@/lib/notification-service';
import moment from 'moment-timezone';
import { getSystemDate, getNonWorkingReason } from '@/lib/date-utils';
import { holidayType } from '@/pages/api/v2/settings/holidays/common';
import { ENFORCE_CSF_CONFIG, findCsfViolations } from '@/lib/csf-utils';
import { findHardRuleViolations, sanitizeCompletedRow, refreshPayoffHistory, isMaturedPdOffsetRow } from '@/lib/collection-rules';
import { loadCsfEnabled } from '@/lib/csf-config-server';
import { NON_MISPAY_REMARKS, NON_DRAFT_TRANSACTION_STATUSES } from '@/lib/constants';
import { resolveMispayment } from '@/lib/mispayment-utils';

// ============================================
// CONFIGURATION
// ============================================
const TIMEZONE = 'Asia/Manila';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
// Stale-page guard (prevData vs DB). 'off' | 'warn' (log only, default) | 'reject' (409 STALE_DATA).
const PREVDATA_GUARD_MODE = String(process.env.LMS_PREVDATA_GUARD || 'warn').toLowerCase();
// Closed-loan guard: 'off' | 'warn' (log only, default) | 'reject' (409). Same convention as LMS_PREVDATA_GUARD.
const CLOSEDLOAN_GUARD_MODE = String(process.env.LMS_CLOSEDLOAN_GUARD || 'warn').toLowerCase();

// ============================================
// GRAPH SETUP (same as original)
// ============================================
const graph = new GraphProvider();
const COLLECTION_TYPE = createGraphType('cashCollections', '_id');
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`);
const CLIENT_TYPE = createGraphType('client', `${CLIENT_FIELDS}`);
const GROUP_TYPE = createGraphType('groups', `${GROUP_FIELDS}`);
const DENOMINATION_TYPE = createGraphType('denomination', `${DENOMINATION_FIELDS}`);
const QR_ENTRY_TYPE = createGraphType('qr_cash_collection_entries', `${QR_CASH_COLLECTION_ENTRY_FIELDS}`);
const QR_CHECK_TYPE = createGraphType('cashCollections', '_id draft origin');

export default apiHandler({
    post: saveWithProtection
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate that transaction date matches server date (Manila timezone)
 */
function validateDate(requestDate) {
    const serverDate = moment(getSystemDate()).tz(TIMEZONE).format('YYYY-MM-DD');
    const clientDate = moment(requestDate).format('YYYY-MM-DD');
    
    if (serverDate !== clientDate) {
        return {
            valid: false,
            serverDate,
            clientDate,
            message: `Date mismatch: Client sent ${clientDate} but server date is ${serverDate}`
        };
    }
    return { valid: true };
}

async function getDelinquentAlertThreshold() {
    try {
        const SETTINGS_TYPE = createGraphType('transactionSettings', 'delinquentAlertThreshold');
        const result = await graph.query(
            queryQl(SETTINGS_TYPE('txSettings'), { limit: 1 })
        );
        const threshold = result?.data?.txSettings?.[0]?.delinquentAlertThreshold;
        // Default to 1 (fire on every delinquent) if not configured
        return (typeof threshold === 'number' && threshold > 0) ? threshold : 1;
    } catch (e) {
        logger.warn({ page: 'saveV2', message: 'Could not fetch delinquentAlertThreshold, defaulting to 1', error: e.message });
        return 1;
    }
}

/**
 * Fire delinquent-related alerts when saving a cash collection.
 * Called per-collection AFTER the loan snapshot is fetched.
 */
async function createDelinquentAlerts(collection, loan, client, branch, user, threshold = 2) {
    if (!branch) return;

    const loName     = user   ? `${user.firstName} ${user.lastName}` : 'Loan Officer';
    const branchName = branch.name || '';
    const groupName  = collection.groupName || '';
    const clientName = client
        ? `${client.firstName} ${client.lastName}`
        : (collection.fullName || 'Client');

    const sharedParams = {
        clientId:      collection.clientId,
        loanId:        collection.loanId,
        groupId:       collection.groupId,
        branchId:      collection.branchId,
        areaId:        branch.areaId,
        regionId:      branch.regionId,
        divisionId:    branch.divisionId,
        loId:          collection.loId,
        createdBy:     user?._id,
        createdByName: loName,
        clientName, loName, branchName, groupName
    };

    const remarksValue = collection.remarks?.value || '';

    // ALERT 1: Delinquent — fires when mispaymentCount reaches threshold
    if (remarksValue.startsWith('delinquent')) {
        const mispaymentCount = (loan?.mispayment || 0) + 1;
        if (mispaymentCount >= threshold) {
            await notifySuccessiveDelinquent({ ...sharedParams, mispaymentCount });
        }
    }

    // ALERT 2: Delinquent client processed as reloaner — always fires
    if (remarksValue.startsWith('reloaner')) {
        if (client?.delinquent === true) {
            await notifyDelinquentAsReloaner({ ...sharedParams });
        }
    }
}

/**
 * Weekend / holiday guard. The register pages disable every input on these days, so the API
 * must refuse too (a direct call or a stale tab would otherwise save). `currentDate` has already
 * been validated against the system date. Fails open if the holiday lookup errors.
 */
async function getNonWorkingReasonForSave(currentDate) {
    const weekend = getNonWorkingReason(currentDate);
    if (weekend) return weekend;
    try {
        const { data } = await graph.query(queryQl(holidayType));
        return getNonWorkingReason(currentDate, data?.holidays ?? []);
    } catch (e) {
        logger.warn({ page: 'saveV2', message: 'Holiday lookup failed, not blocking the save', error: e.message });
        return null;
    }
}

const PREV_TOLERANCE = 0.005;
const prevDiffers = (prev, current) =>
    prev !== undefined && prev !== null && prev !== '-' && prev !== '' &&
    Math.abs(safeNumber(prev) - safeNumber(current)) > PREV_TOLERANCE;

/**
 * Stale-page detection. The browser sends prevData = the row's values BEFORE the user edited it
 * (MCBU, loan balance, ...). updateLoan() then writes browser-computed totals, so if another tab or
 * user changed the loan in between, those totals silently overwrite the newer data. For rows that
 * will update a loan, compare prevData.mcbu / prevData.loanBalance with the loan as it is now.
 * Rows already finalized in the DB (re-sent with the group) are skipped: their loan already
 * reflects that transaction, so a difference there is expected.
 */
async function findStalePrevDataRows(rows) {
    const candidates = rows.filter(r =>
        r.loanId && r.prevData && !r.draft &&
        r.status !== 'tomorrow' && r.status !== 'pending' && r.status !== 'totals');
    if (candidates.length === 0) return [];

    const loanIds = Array.from(new Set(candidates.map(r => r.loanId)));
    const ccIds = candidates.map(r => r._id).filter(Boolean);

    const [loans, finalized] = await Promise.all([
        graph.query(queryQl(createGraphType('loans', '_id mcbu loanBalance')('stale_loans'), { where: { _id: { _in: loanIds } } }))
            .then(r => r.data?.stale_loans ?? []),
        ccIds.length === 0 ? [] : graph.query(queryQl(createGraphType('cashCollections', '_id draft origin')('stale_ccs'), {
            where: { _id: { _in: ccIds }, draft: { _eq: false }, origin: { _neq: 'pre-save' } }
        })).then(r => r.data?.stale_ccs ?? [])
    ]);

    const loanById = new Map(loans.map(l => [l._id, l]));
    const finalizedIds = new Set(finalized.map(c => c._id));

    const stale = [];
    for (const r of candidates) {
        if (r._id && finalizedIds.has(r._id)) continue;
        const loan = loanById.get(r.loanId);
        if (!loan) continue;
        const fields = [];
        if (prevDiffers(r.prevData.mcbu, loan.mcbu)) fields.push({ field: 'mcbu', pageBaseline: safeNumber(r.prevData.mcbu), db: safeNumber(loan.mcbu) });
        if (prevDiffers(r.prevData.loanBalance, loan.loanBalance)) fields.push({ field: 'loanBalance', pageBaseline: safeNumber(r.prevData.loanBalance), db: safeNumber(loan.loanBalance) });
        if (fields.length > 0) stale.push({ clientId: r.clientId, loanId: r.loanId, fields });
    }
    return stale;
}

/**
 * Closed-loan guard. updateLoan() writes the submitted row over the loan (status, balance, MCBU, ...),
 * so a row that is NOT a closing row but points at a loan that is already closed silently re-opens it
 * and corrupts the offset (seen on a weekly Offset: the loan kept its close date and cycle 0 but came
 * back active with its old balance/MCBU). Only rows that will update a loan are checked; drafts,
 * tomorrow/pending release rows and totals never update an existing loan here. A row that is itself
 * 'closed' (an Offset re-sent with the group) is expected and is not flagged.
 */
async function findClosedLoanOverwrites(rows) {
    const candidates = rows.filter(r =>
        r.loanId && !r.draft && r.status !== 'closed' &&
        r.status !== 'tomorrow' && r.status !== 'pending' && r.status !== 'totals');
    if (candidates.length === 0) return [];

    const loanIds = Array.from(new Set(candidates.map(r => r.loanId)));
    const closedLoans = await graph.query(
        queryQl(createGraphType('loans', '_id status closedDate')('closed_loans'), {
            where: { _id: { _in: loanIds }, status: { _eq: 'closed' } }
        })
    ).then(r => r.data?.closed_loans ?? []);
    if (closedLoans.length === 0) return [];

    const closedById = new Map(closedLoans.map(l => [l._id, l]));
    return candidates
        .filter(r => closedById.has(r.loanId))
        .map(r => ({
            clientId: r.clientId,
            loanId: r.loanId,
            fullName: r.fullName,
            slotNo: r.slotNo,
            incomingStatus: r.status,
            remarks: r.remarks?.value,
            closedDate: closedById.get(r.loanId).closedDate
        }));
}

// ============================================
// MAIN HANDLER WITH PROTECTION
// ============================================

async function saveWithProtection(req, res) {
    const user_id = req?.auth?.sub;
    const user = await findUserById(user_id);
    const transactionId = generateUUID();
    let response = {};
    let statusCode = 200;

    try {
        const data = req.body;
        const currentDate = data.currentDate;

        // Parse once here — retries reuse the already-parsed array
        if (typeof data.collection === 'string') {
            data.collection = JSON.parse(data.collection);
        }

        // Log start
        logger.debug({
            user_id,
            transactionId,
            page: 'Cash Collection SaveV2',
            message: 'Starting save',
            groupId: data.collection[0]?.groupId
        });

        // Step 1: Validate date
        const dateCheck = validateDate(currentDate);
        if (!dateCheck.valid) {
            logger.error({
                user_id,
                transactionId,
                page: 'Cash Collection SaveV2',
                message: 'Date validation failed',
                ...dateCheck
            });

            return res.status(400).json({
                success: false,
                error: true,
                errorCode: 'DATE_MISMATCH',
                message: 'Transaction date mismatch. The date may have changed. Please refresh the page and try again.',
                transactionId,
                details: dateCheck
            });
        }

        // Step 1a: no transactions on a weekend or a holiday (the UI is disabled then; enforce it here too)
        const nonWorking = await getNonWorkingReasonForSave(currentDate);
        if (nonWorking) {
            logger.warn({
                user_id,
                transactionId,
                page: 'Cash Collection SaveV2',
                message: `Save blocked: ${currentDate} is a ${nonWorking}`
            });

            return res.status(400).json({
                success: false,
                error: true,
                errorCode: 'NON_WORKING_DAY',
                message: nonWorking === 'weekend'
                    ? 'Transactions are not allowed on weekends.'
                    : 'Transactions are not allowed on holidays.',
                transactionId
            });
        }

        // Step 1b: CSF config guard (before the retry loop: deterministic, never worth retrying)
        const csfRows = data.collection.filter(cc => cc.status !== 'totals');

        // Audit log of exactly what the client sent (ids and numbers only, no names/personal data).
        // Lets us compare the first vs the second Save Draft when a row changes unexpectedly.
        logger.info({
            user_id,
            transactionId,
            page: 'Cash Collection SaveV2 Payload',
            groupId: csfRows[0]?.groupId,
            rows: csfRows.map(cc => ({
                clientId: cc.clientId,
                loanId: cc.loanId,
                _id: cc._id,
                status: cc.status,
                draft: cc.draft,
                remarks: cc.remarks?.value ?? cc.remarks ?? null,
                hasCloseRemarks: !!cc.closeRemarks,
                mcbu: cc.mcbu,
                mcbuCol: cc.mcbuCol,
                mcbuWithdrawal: cc.mcbuWithdrawal,
                mcbuReturnAmt: cc.mcbuReturnAmt,
                csfCollection: cc.csfCollection,
                paymentCollection: cc.paymentCollection,
                targetCollection: cc.targetCollection,
                excess: cc.excess,
                loanBalance: cc.loanBalance,
                noOfPayments: cc.noOfPayments,
                prevMcbu: cc.prevData?.mcbu,
                prevLoanBalance: cc.prevData?.loanBalance,
                dirty: cc._dirty,
            })),
        });
        if (csfRows.length > 0) {
            const csfEnabled = await loadCsfEnabled(csfRows[0].groupId);
            const violations = findCsfViolations(csfRows, csfEnabled);

            csfRows.forEach(sanitizeCompletedRow);
            csfRows.forEach(refreshPayoffHistory);

            // Hard business rules enforced server-side (apply to drafts too)
            let ruleViolations = findHardRuleViolations(csfRows, { csfEnabled });

            // An Offset already persisted as 'closed' (re-sent with the group) is history: it has no
            // close reason in the payload, but it was accepted earlier. Only NEW offsets need a reason.
            const reasonViolations = ruleViolations.filter(v => v.code === 'OFFSET_REASON_REQUIRED');
            if (reasonViolations.length > 0) {
                // Top-level rows of a transferred-in loan carry the LOAN id in _id; the real cashCollections id is on current[0]
                const ccId = (r) => r.current?.[0]?._id ?? r._id;
                const ids = csfRows
                    .filter(r => reasonViolations.some(v => v.clientId === r.clientId) && ccId(r) && ccId(r) !== r.loanId)
                    .map(ccId);
                if (ids.length > 0) {
                    const persisted = await graph.query(
                        queryQl(createGraphType('cashCollections', '_id status')('persisted_closed'), {
                            where: { _id: { _in: ids }, status: { _eq: 'closed' } }
                        })
                    ).then(r => r.data?.persisted_closed ?? []);
                    const persistedIds = new Set(persisted.map(x => x._id));
                    const okClients = new Set(csfRows.filter(r => persistedIds.has(ccId(r))).map(r => r.clientId));
                    ruleViolations = ruleViolations.filter(v => !(v.code === 'OFFSET_REASON_REQUIRED' && okClients.has(v.clientId)));
                }
            }
            if (ruleViolations.length > 0) {
                logger.warn({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: 'Hard business rule violation',
                    violations: ruleViolations.map(v => ({ code: v.code, clientId: v.clientId }))
                });
                return res.status(200).json({
                    success: false,
                    error: true,
                    errorCode: ruleViolations[0].code,
                    message: Array.from(new Set(ruleViolations.map(v => v.message))).join('\n'),
                    violations: ruleViolations,
                    transactionId
                });
            }

            if (violations.length > 0) {
                logger.warn({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: 'CSF values submitted for a CSF-disabled branch/group',
                    enforced: ENFORCE_CSF_CONFIG,
                    clientIds: violations.map(v => v.clientId)
                });

                if (ENFORCE_CSF_CONFIG) {
                    return res.status(200).json({
                        success: false,
                        error: true,
                        errorCode: 'CSF_CONFIG_MISMATCH',
                        message: 'CSF settings for this group changed. Please refresh the page and try again.',
                        transactionId
                    });
                }
            }
        }

        // Step 1c: stale-page guard (see findStalePrevDataRows). Never retried: it is deterministic.
        if (PREVDATA_GUARD_MODE !== 'off') {
            try {
                const staleRows = await findStalePrevDataRows(csfRows);
                if (staleRows.length > 0) {
                    logger.warn({
                        user_id,
                        transactionId,
                        page: 'Cash Collection SaveV2',
                        message: 'Stale page detected: prevData does not match the loan in the DB',
                        mode: PREVDATA_GUARD_MODE,
                        rows: staleRows
                    });

                    if (PREVDATA_GUARD_MODE === 'reject') {
                        return res.status(409).json({
                            success: false,
                            error: true,
                            errorCode: 'STALE_DATA',
                            message: 'This page is out of date because the loan changed since it was loaded. Please refresh the page and try again.',
                            staleRows,
                            transactionId
                        });
                    }
                }
            } catch (e) {
                // the guard must never be the reason a save fails
                logger.warn({ user_id, transactionId, page: 'Cash Collection SaveV2', message: 'Stale-page check failed, continuing', error: e.message });
            }
        }

        // Step 1d: closed-loan guard (see findClosedLoanOverwrites). Deterministic, never retried.
        if (CLOSEDLOAN_GUARD_MODE !== 'off') {
            try {
                const overwrites = await findClosedLoanOverwrites(csfRows);
                if (overwrites.length > 0) {
                    logger.warn({
                        user_id,
                        transactionId,
                        page: 'Cash Collection SaveV2',
                        message: 'Row would overwrite a loan that is already closed',
                        mode: CLOSEDLOAN_GUARD_MODE,
                        rows: overwrites
                    });

                    if (CLOSEDLOAN_GUARD_MODE === 'reject') {
                        const names = overwrites.map(o => o.fullName || o.clientId).join(', ');
                        return res.status(409).json({
                            success: false,
                            error: true,
                            errorCode: 'LOAN_ALREADY_CLOSED',
                            message: `The loan is already closed for: ${names}. Please refresh the page; nothing was saved.`,
                            closedLoanRows: overwrites,
                            transactionId
                        });
                    }
                }
            } catch (e) {
                // the guard must never be the reason a save fails
                logger.warn({ user_id, transactionId, page: 'Cash Collection SaveV2', message: 'Closed-loan check failed, continuing', error: e.message });
            }
        }

        // Step 2: Execute save with retry
        let lastError = null;
        let attempt = 0;
        let offsetCollections = []; // Track offsets for notifications

        while (attempt < MAX_RETRIES) {
            attempt++;
            try {
                logger.debug({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: `Save attempt ${attempt}/${MAX_RETRIES}`
                });

                // Call the actual save logic - returns offsetCollections
                offsetCollections = await executeSave(req, user_id, transactionId, user);
                lastError = null; // success: an earlier failed attempt must not trigger the throw below

                // Success!
                logger.info({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: 'Save completed successfully',
                    attempts: attempt,
                    offsetCount: offsetCollections.length
                });

                break; // Exit retry loop on success

            } catch (error) {
                lastError = error;
                logger.warn({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: `Save attempt ${attempt} failed`,
                    error: error.message
                });

                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS * attempt);
                }
            }
        }

        // If all retries failed, throw the last error
        if (lastError && attempt >= MAX_RETRIES) {
            throw lastError;
        }

        // Create notifications for offset transactions (after successful save)
        // Note: notifyLoanOffset already checks if notifications are enabled internally
        if (offsetCollections.length > 0) {
            for (const offset of offsetCollections) {
                try {
                    const branches = await findBranches({ _id: { _eq: offset.branchId } });
                    const branch = branches?.[0];

                    if (branch) {
                        await notifyLoanOffset({
                            clientName: offset.fullName,
                            clientId: offset.clientId,
                            loanId: offset.loanId,
                            previousBalance: offset.previousBalance,
                            groupId: offset.groupId,
                            branchId: offset.branchId,
                            areaId: branch.areaId,
                            regionId: branch.regionId,
                            divisionId: branch.divisionId,
                            loId: offset.loId,
                            createdBy: user?._id || user_id,
                            createdByName: user ? `${user.firstName} ${user.lastName}` : 'System'
                        });
                    }
                } catch (notifError) {
                    // Don't fail the transaction if notification fails
                    logger.error({
                        user_id,
                        transactionId,
                        page: 'Cash Collection SaveV2',
                        message: 'Failed to create offset notification',
                        error: notifError.message,
                        clientId: offset.clientId
                    });
                }
            }
            
            logger.debug({
                user_id,
                transactionId,
                page: 'Cash Collection SaveV2',
                message: `Processed ${offsetCollections.length} offset notifications`
            });
        }

        try {
            const auditRows = Array.isArray(data.collection) ? data.collection.filter(c => c.status !== 'totals') : [];
            const events = buildLorAuditEvents(auditRows, {
                transactionId, currentDate, attempts: attempt,
                draft: auditRows.length > 0 && auditRows.every(c => c.draft),
            });
            events.slice(0, MAX_LOR_EVENTS).forEach(e => logAudit(req, e));
        } catch (auditErr) { /* audit must never break a save */ }

        return res.status(200).json({
            success: true,
            transactionId,
            attempts: attempt
        });

    } catch (error) {
        logger.error({
            user_id,
            transactionId,
            page: 'Cash Collection SaveV2',
            message: 'Save failed after all retries',
            error: error.message,
            stack: error.stack
        });

        statusCode = 500;
        response = {
            success: false,
            error: true,
            errorCode: 'SAVE_FAILED',
            message: 'Failed to save transaction. Please try again.',
            transactionId,
            debugError: error.message,
            debugStack: error.stack?.split('\n').slice(0, 5)
        };

        return res.status(statusCode).json(response);
    }
}

// ============================================
// ORIGINAL SAVE LOGIC (unchanged from save.js)
// Returns: Array of offset collections for notification
// ============================================

/**
 * An advance (reloaner) payoff row: the cashCollections row of the CURRENT loan of a client who just
 * fully paid and already has a pending reloan. It is sent with status 'pending', but its loan is still
 * active/completed. The reloan's own release row is different: its loan has status 'pending'.
 */
function isAdvancePayoffRow(collection, loan) {
    return collection.status === 'pending'
        && collection.advance === true
        && !collection.draft
        && Number(collection.loanBalance) <= 0
        && !!loan
        && (loan.status === 'active' || loan.status === 'completed');
}

async function executeSave(req, user_id, transactionId, user) {
    let data = req.body;
    const currentDate = data.currentDate;
    const currentTime = data.currentTime;
    // collection already parsed in saveWithProtection before the retry loop
    const overallTotalNetCollection = data.overallTotalNetCollection || 0;

    const mutationQl = [];
    const offsetCollections = []; // Track offsets for notifications
    const rowsToVerify = []; // rows that updated a loan: each must end up with a cashCollections row

    const delinquentAlertThreshold = await getDelinquentAlertThreshold();

    if (data.collection.length > 0) {
        let existCC = [];
        let newCC = [];
        const qrMergeUpdates = [];
        
        logger.debug({user_id, transactionId, page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`});

        // A cashCollections row can legitimately have _id === loanId (pending/tomorrow release rows are
        // inserted with the loan id as primary key). `_id !== loanId` alone therefore cannot tell a new row
        // from an already-saved one: re-submitting such a row INSERTs the same primary key again
        // ("duplicate key ... cashCollections_pkey"). Look the candidates up once and treat existing ones as updates.
        const idEqualsLoanIds = [...new Set(
            data.collection
                .filter(c => c.status !== 'totals' && c._id && c._id === c.loanId)
                .map(c => c._id)
        )];
        const existingSelfIdCC = new Set();
        if (idEqualsLoanIds.length > 0) {
            const found = await graph.query(
                queryQl(createGraphType('cashCollections', '_id')('cc_self_id'), { where: { _id: { _in: idEqualsLoanIds } } })
            ).then(r => r.data?.cc_self_id ?? []);
            found.forEach(x => existingSelfIdCC.add(x._id));
            if (found.length > 0) {
                logger.warn({
                    user_id, transactionId, page: 'Cash Collection SaveV2',
                    message: 'cashCollections row with _id equal to loanId already exists, updating instead of inserting',
                    ids: found.map(x => x._id)
                });
            }
        }
        
        const promiseData = data.collection.map(async cc => {
            if (cc.status !== "totals") {

                let collection = JSON.parse(JSON.stringify(cc));
                delete collection.reverted;
                // cashCollections.mispayment is a boolean; loans.mispayment is a counter.
                // Never let a counter (or '-') from the client reach the boolean column or the counter increment.
                const mispaymentSent = collection.mispayment === true;
                collection.mispayment = resolveMispayment(collection);

                // Offsetting a matured PD loan clears the past due on the cashCollections row (and on the loan, see updateLoan)
                if (isMaturedPdOffsetRow(collection)) {
                    collection.pastDue = 0;
                }

                // New loans from the tomorrow tab are release-only rows. They are never
                // part of a draft group save, so never persist draft=true for them.
                if (NON_DRAFT_TRANSACTION_STATUSES.includes(collection.status)) {
                    collection.draft = false;
                }

                if (mispaymentSent && !collection.mispayment) {
                    logger.warn({
                        user_id, transactionId, page: 'Cash Collection SaveV2',
                        message: 'mispayment=true overridden to false',
                        clientId: collection.clientId, loanId: collection.loanId,
                        paymentCollection: collection.paymentCollection,
                        remarks: collection.remarks?.value, qrEntryId: collection.qrEntryId
                    });
                }
                if (NON_MISPAY_REMARKS.includes(collection.remarks?.value)) {
                    collection.mispayment = false;
                }

                // get loan snapshot 
                let [loan] = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);

                // Propagate bmRevertCount from loan into the CC record so the UI can check it
                if (loan) {
                    collection.bmRevertCount = loan.bmRevertCount || 0;
                }

                if (!loan) {
                    logger.warn({user_id, transactionId, page: 'Cash Collection SaveV2', message: 'Loan not found', loanId: collection.loanId});
                    return;
                }

                // ── Delinquent alerts — runs after loan is confirmed valid ──
                try {
                    const remarksValue = collection.remarks?.value || '';
                    const isDelinquent = remarksValue.startsWith('delinquent');
                    const isReloaner   = remarksValue.startsWith('reloaner');

                    if ((isDelinquent || isReloaner) && !collection.draft) {
                        console.log('Collection is delinquent or reloaner, checking alerts...', { collectionId: collection._id, loanId: collection.loanId, clientId: collection.clientId });
                        // Use unique alias per client to avoid collision in concurrent Promise.all
                        const clientAlias = `clientAlert_${collection.clientId.replace(/-/g, '_')}`;

                        const [clientData] = await graph.query(
                            queryQl(CLIENT_TYPE(clientAlias), { where: { _id: { _eq: collection.clientId } } })
                        ).then(res => res.data?.[clientAlias] || []);

                        const branches = await findBranches({ _id: { _eq: collection.branchId } });
                        const branch   = branches?.[0];

                        await createDelinquentAlerts(collection, loan, clientData, branch, user, delinquentAlertThreshold);
                    }
                } catch (alertErr) {
                    logger.error({ user_id, transactionId, page: 'Cash Collection SaveV2', message: 'Delinquent alert failed', error: alertErr.message });
                }

                const loan_history = {
                    loan_id: loan._id,
                    client_id: loan.clientId,
                    user_id: user_id,
                    data: loan
                };

                mutationQl.push(
                    insertQl(createGraphType('loans_history', `_id`)('loans_history_' + (mutationQl.length + 1)), {
                        objects: [loan_history]
                    })
                );

                // a completed (green) client was already fully paid earlier: never restamp fullPaymentDate
                if (collection.loanBalance <= 0 && !collection.fullPaymentDate && collection.status !== 'completed') {
                    collection.fullPaymentDate = collection.fullPaymentDate ? collection.fullPaymentDate : currentDate;
                }

                if (collection.status === 'completed' && (collection?.remarks?.value?.startsWith('offset') || collection.mcbuReturnAmt > 0)) {
                    collection.status = "closed";
                    // Track offset for notification
                    if (collection?.remarks?.value?.startsWith('offset')) {
                        offsetCollections.push({
                            clientId: collection.clientId,
                            loanId: collection.loanId,
                            groupId: collection.groupId,
                            branchId: collection.branchId,
                            loId: collection.loId,
                            fullName: loan?.fullName || collection.fullName,
                            previousBalance: collection.prevData?.loanBalance || loan?.loanBalance || 0
                        });
                    }
                }

                // let activeLoan = collection?.activeLoan;
                // if (collection.status != 'pending' && collection.activeLoan == 0) {
                //     activeLoan = collection?.prevData?.activeLoan ? collection.prevData?.activeLoan : 0;
                // }

                logger.debug({user_id, transactionId, page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`, currentDate: currentDate, clientId: collection.clientId});
                
                if (collection.qrEntryId) {
                    // Never trust the frontend's _id mapping for a QR-sourced row —
                    // always re-check the actual current DB state directly. A
                    // pre-save placeholder (or an office-started draft) may already
                    // exist and needs to be upserted onto, not duplicated; a real
                    // finalized (non-draft) transaction must never be touched by a
                    // QR-sourced payload.
                    const [existingRealRow] = await graph.query(
                        queryQl(QR_CHECK_TYPE('qr_precheck'), {
                            where: { clientId: { _eq: collection.clientId }, dateAdded: { _eq: currentDate } },
                            limit: 1,
                        })
                    ).then(res => res.data?.qr_precheck ?? []);

                    if (existingRealRow && existingRealRow.draft !== true && existingRealRow.origin !== 'pre-save') {
                        logger.warn({
                            user_id, transactionId, page: 'Cash Collection SaveV2',
                            message: 'Skipped QR-sourced collection — a finalized non-draft transaction already exists for this client today',
                            clientId: collection.clientId,
                        });
                        return; // skip this cc entirely — not saved, its qr entry stays unmarked
                    }

                    if (existingRealRow) {
                        collection._id = existingRealRow._id;
                    }
                }

                if (collection.hasOwnProperty('_id') && (collection._id != collection?.loanId || existingSelfIdCC.has(collection._id))) {
                    collection.modifiedBy = user_id;
                    collection.modifiedByName = `${user?.firstName} ${user?.lastName}`;
                    collection.modifiedDateTime = new Date();
                    const existCollection = {...assignNullValues(collection)};
                    delete existCollection.mcbuHistory;

                    await fixCashCollectionReference(existCollection);
                    existCC.push(existCollection);

                    if (collection.qrEntryId) {
                        qrMergeUpdates.push({ qrEntryId: collection.qrEntryId, cashCollectionId: existCollection._id });
                    }
                } else {
                    if (collection.qrEntryId && !collection._id) {
                        collection._id = generateUUID();
                    }

                    collection.insertedBy = user_id;
                    collection.insertedByName = `${user?.firstName} ${user?.lastName}`;
                    collection.insertedDateTime = new Date();
                    const newCollection = {...assignNullValues(collection)};
                    delete newCollection.mcbuHistory;

                    await fixCashCollectionReference(collection);
                    newCC.push(collection);

                    if (collection.qrEntryId) {
                        qrMergeUpdates.push({ qrEntryId: collection.qrEntryId, cashCollectionId: collection._id });
                    }
                }
                
                if (collection.status !== "tomorrow" && collection.status !== "pending" && !collection.draft) {
                    await updateLoan(user_id, mutationQl, collection, currentDate);
                    await updateClient(user_id, mutationQl, collection);
                    rowsToVerify.push(collection);
                } else if (isAdvancePayoffRow(collection, loan)) {
                    // The page sends a fully-paid client with a pending reloan as status 'pending'
                    // (temp.status = temp.advance ? 'pending' : 'completed'), which skips updateLoan above.
                    // savePendingLoans then either closes the loan (release due today) or only flips the status
                    // to 'completed', which left loanBalance / activeLoan / mcbu / noOfPayments / fullPaymentDate
                    // untouched. Apply the payoff to the loan now, as a normal 'completed' row; the reloan
                    // release (updatePendingLoan) still closes it afterwards.
                    await updateLoan(user_id, mutationQl, { ...collection, status: 'completed' }, currentDate);
                }

                // A resubmitted (non-draft) reverted row resolves the revert. updateLoan never writes loans.reverted
                // and is skipped for pending/advance rows, so clear it here.
                if (collection.fromReverted && !collection.draft && collection.loanId) {
                    mutationQl.push(updateQl(LOAN_TYPE('update_loans_reverted_' + mutationQl.length), {
                        set: { reverted: false },
                        where: { _id: { _eq: collection.loanId } }
                    }));
                }

                if (collection.status == 'tomorrow' && collection.mcbuWithdrawal > 0 && !collection.hasMcbuWithdrawal) {
                    await updateLoanMcbuWithdrawal(user_id, mutationQl, collection);
                }
            }
        });

        await Promise.all(promiseData);

        if (newCC.length > 0) {
            await saveCollection(mutationQl, newCC, currentDate);
        }

        // Weekly-only hardening: pre-save and the missing-row insert apply to weekly groups; daily saves are untouched.
        const isWeeklySave = data.collection.some(c => c.status !== 'totals') && data.collection.filter(c => c.status !== 'totals').every(c => c.occurence === 'weekly');

        if (existCC.length > 0 && isWeeklySave) {
            // An UPDATE on a cash collection that no longer exists matches 0 rows and succeeds
            // silently, while the loan/client updates in the same request still apply. That leaves
            // loans closed / clients offset with NO cashCollections row. Rows whose _id is not in
            // the table are therefore inserted instead of updated.
            const ids = existCC.map(c => c._id);
            const found = await graph.query(
                queryQl(createGraphType('cashCollections', '_id')('cc_present'), { where: { _id: { _in: ids } } })
            ).then(r => r.data?.cc_present ?? []);
            const foundIds = new Set(found.map(x => x._id));
            const toInsert = existCC.filter(c => !foundIds.has(c._id));
            const toUpdate = existCC.filter(c => foundIds.has(c._id));

            if (toInsert.length > 0) {
                logger.warn({
                    user_id, transactionId, page: 'Cash Collection SaveV2',
                    message: 'Cash collection _id not found, inserting instead of updating',
                    rows: toInsert.map(c => ({ _id: c._id, clientId: c.clientId, loanId: c.loanId, status: c.status }))
                });
                await saveCollection(mutationQl, toInsert, currentDate);
            }
            if (toUpdate.length > 0) {
                await updateCollection(mutationQl, toUpdate);
            }
        } else if (existCC.length > 0) {
            await updateCollection(mutationQl, existCC);
        }

        qrMergeUpdates.forEach(({ qrEntryId, cashCollectionId }) => {
            mutationQl.push(
                updateQl(QR_ENTRY_TYPE('qr_merge_' + (mutationQl.length + 1)), {
                    set: { status: 'merged', mergedIntoCashCollectionId: cashCollectionId, updatedDateTime: new Date() },
                    where: { _id: { _eq: qrEntryId } },
                })
            );
        });

        if (overallTotalNetCollection > 0) {
            await updateDenomination(mutationQl, data.collection[0]?.groupId, currentDate, overallTotalNetCollection);
        }

        // On final Submit, any row of this group/date still carrying the 'pre-save' placeholder
        // origin (rows the page did not send: pending/open/untouched) must be cleared too,
        // otherwise they stay 'pre-save' after the group is closed.
        const submitGroupId = data.collection[0]?.groupId;
        if (isWeeklySave && submitGroupId && data.collection.length > 0 && data.collection.every(c => !c.draft)) {
            mutationQl.push(
                updateQl(COLLECTION_TYPE('collections_presave_clear_' + (mutationQl.length + 1)), {
                    set: { origin: null },
                    where: { groupId: { _eq: submitGroupId }, dateAdded: { _eq: currentDate }, origin: { _eq: 'pre-save' } },
                })
            );
        }

        // save all changes in one request
        if (mutationQl.length > 0) {
            const result = await graph.mutation(...mutationQl);
            
            // Check for GraphQL errors
            if (result.errors && result.errors.length > 0) {
                const errorMsg = result.errors.map(e => e.message).join(', ');
                throw new Error(`GraphQL mutation failed: ${errorMsg}`);
            }
        }

        // Final invariant: every row that updated a loan has a cashCollections row for this date.
        // Independent of how the rows were routed above (insert / update / weekly missing-row insert).
        await healMissingCashCollections({ rows: rowsToVerify, currentDate, user_id, transactionId, req });
        await healUnclosedLoans({ rows: rowsToVerify, currentDate, user_id, transactionId, req });

        const reverted = data.collection.filter(c => c.fromReverted && !c.advance);
        if (reverted.length == 0) {
            const pendingLoans = data.collection.filter(c => (c.status === 'pending' || c.status === 'closed') && c.advance == true);
            if (pendingLoans.length > 0) {
                await savePendingLoans(user_id, pendingLoans);
            }
        }
    }

    // Return offset collections for notification processing
    return offsetCollections;
}

// ============================================
// HELPER FUNCTIONS (same as original save.js)
// ============================================

async function fixCashCollectionReference(cashCollection) {
    if(!cashCollection.groupId) {
        throw { message: 'No group id for cashCollection loanId = ' + cashCollection.loanId };
    }

    const [group] = await findGroups({ _id: { _eq: cashCollection.groupId }});

    if(!group) {
        throw { message: 'No group found = ' + cashCollection.loanId };
    }

    if(group.loanOfficerId) {
        cashCollection.loId = group.loanOfficerId;
    }
    return cashCollection;
}

function cleanUpCollection(c) {
    const fields = CASH_COLLECTIONS_FIELDS.split('\n').map(f => f.trim()).filter(f => !!f);
    const allow_fields = Object.keys(c).filter(c => fields.includes(c));
    
    const cc = allow_fields.reduce((g, f) => ({
        ... g,
        [f]: c[f],
    }), {});

    return ({
        ... cc,
        loanTerms: `${c.loanTerms}`,
        coMaker: c.coMaker === '-' ? null : `${c.coMaker}`,
        noOfPayments: c.noOfPayments === '-' ? 0 : +c.noOfPayments,
    });
}

const assignNullValues = (obj, origin) => {
    let cc = { ...obj };

    if (origin == 'client') {
        cc.delinquent = cc.delinquent ? cc.delinquent : false;
        cc.duplicate = cc.duplicate ? cc.duplicate : false;
        return cc;
    }

    cc.reverted = cc.reverted ? cc.reverted : false;
    cc.revertedTransfer = cc.revertedTransfer ? cc.revertedTransfer : false;
    cc.ldfApproved = cc.ldfApproved ? cc.ldfApproved : false;
    cc.maturedPD = cc.maturedPD ? cc.maturedPD : false;
    cc.transfer = cc.transfer ? cc.transfer : false;
    cc.transferred = cc.transferred ? cc.transferred : false;
    cc.advance = cc.advance ? cc.advance : false;
    cc.transferredReleased = cc.transferredReleased ? cc.transferredReleased : false;
    cc.advanceTransaction = cc.advanceTransaction ? cc.advanceTransaction : false;

    return cc;
};

/**
 * Post-save safety net. A loan can be closed/updated while its cashCollections row never got written
 * (seen in production: 4 Offset loans closed on 2026-11-16, no cashCollections for those clients, totals short).
 * After the main mutation, verify by clientId + date and insert whatever is missing, and log it loudly.
 */
async function healMissingCashCollections({ rows, currentDate, user_id, transactionId, req }) {
    if (!rows || rows.length === 0) return;

    const clientIds = [...new Set(rows.map(r => r.clientId).filter(Boolean))];
    if (clientIds.length === 0) return;

    const present = await graph.query(
        queryQl(createGraphType('cashCollections', '_id clientId loanId status paymentCollection')('cc_verify'), {
            where: { clientId: { _in: clientIds }, dateAdded: { _eq: currentDate } }
        })
    ).then(r => r.data?.cc_verify ?? []);

    // one row per client/day is expected; prefer the one that belongs to the loan we just updated
    const byClient = new Map();
    for (const c of present) {
        const prev = byClient.get(c.clientId);
        if (!prev) byClient.set(c.clientId, c);
    }
    const seen = new Set();
    const missing = [];
    const stale = []; // row exists but the save never reached it (placeholder still shows old status / amount)
    for (const r of rows) {
        if (!r.clientId || seen.has(r.clientId)) continue;
        seen.add(r.clientId);
        const cur = present.find(c => c.clientId === r.clientId && c.loanId === r.loanId) || byClient.get(r.clientId);
        if (!cur) {
            missing.push(r);
        } else if (cur.status !== r.status || Number(cur.paymentCollection ?? 0) !== Number(r.paymentCollection ?? 0)) {
            stale.push({ row: r, current: cur });
        }
    }
    if (missing.length === 0 && stale.length === 0) return;

    const describe = r => ({
        _id: r._id, loanId: r.loanId, clientId: r.clientId, status: r.status, draft: r.draft,
        remarks: r.remarks?.value ?? r.remarks ?? null, paymentCollection: r.paymentCollection
    });
    logger.error({
        user_id, transactionId, page: 'Cash Collection SaveV2',
        message: 'cashCollections not consistent with the loan update after save, repairing',
        currentDate,
        missing: missing.map(describe),
        stale: stale.map(s => ({ sent: describe(s.row), stored: s.current }))
    });

    logAudit(req, {
        action: 'COLLECTION_AUTO_HEALED', category: 'COLLECTION', severity: 'CRITICAL',
        entityType: 'cashCollection', entityId: (missing[0] || stale[0]?.row)?._id ?? null,
        description: `cashCollections out of sync after save: ${missing.length} missing, ${stale.length} stale — repaired`,
        metadata: { transactionId, currentDate, missing: missing.map(describe).slice(0, 50), stale: stale.map(s => ({ sent: describe(s.row), stored: s.current })).slice(0, 50) },
    });

    const mutations = [];
    if (missing.length > 0) {
        await saveCollection(mutations, missing.map(r => ({ ...r, _id: generateUUID(), draft: false })), currentDate);
    }
    if (stale.length > 0) {
        await updateCollection(mutations, stale.map(({ row, current }) => ({
            ...assignNullValues(row),
            _id: current._id,
            draft: false,
            modifiedBy: user_id,
            modifiedDateTime: new Date(),
        })));
    }
    const result = await graph.mutation(...mutations);
    if (result?.errors?.length) {
        throw new Error(`Repair of cashCollections after save failed: ${result.errors.map(e => e.message).join(', ')}`);
    }
}

/**
 * Post-save safety net #2. A closed (Offset) cashCollections row must always have a closed loan.
 * Seen in production (2026-11-19): after a BM revert + re-submit the closed row was written but the loan
 * stayed 'completed' and the client/group were never offset, so the register showed a green "completed" row.
 * Re-applies the same loan/client/group updates the main save performs, only for loans that are still not closed.
 */
async function healUnclosedLoans({ rows, currentDate, user_id, transactionId, req }) {
    const closedRows = (rows || []).filter(r => r.loanId && r.status === 'closed' && !r.draft);
    if (closedRows.length === 0) return;

    const loanIds = [...new Set(closedRows.map(r => r.loanId))];
    const loans = await graph.query(
        queryQl(createGraphType('loans', '_id status')('heal_loans'), { where: { _id: { _in: loanIds } } })
    ).then(r => r.data?.heal_loans ?? []);
    const notClosed = new Set(loans.filter(l => l.status !== 'closed').map(l => l._id));
    const toHeal = closedRows.filter(r => notClosed.has(r.loanId));
    if (toHeal.length === 0) return;

    logger.error({
        user_id, transactionId, page: 'Cash Collection SaveV2',
        message: 'closed cashCollections row but loan not closed after save, repairing',
        rows: toHeal.map(r => ({ _id: r._id, loanId: r.loanId, clientId: r.clientId, remarks: r.remarks?.value ?? null }))
    });

    logAudit(req, {
        action: 'LOAN_AUTO_HEALED_CLOSE', category: 'LOAN', severity: 'CRITICAL',
        entityType: 'loan', entityId: toHeal[0].loanId, clientId: toHeal[0].clientId,
        description: `${toHeal.length} closed cashCollections row(s) had a loan that was not closed — repaired`,
        metadata: { transactionId, currentDate, loanIds: toHeal.map(r => r.loanId).slice(0, 50) },
    });

    const mutations = [];
    for (const r of toHeal) {
        await updateLoan(user_id, mutations, r, currentDate);
        await updateClient(user_id, mutations, r);
    }
    const result = await graph.mutation(...mutations);
    if (result?.errors?.length) {
        throw new Error(`Repair of unclosed loans after save failed: ${result.errors.map(e => e.message).join(', ')}`);
    }
}

async function saveCollection(mutationQL, collections, currentDate) {
    const objects = collections.map(c => ({
        ... cleanUpCollection(c),
        // a placeholder origin must never survive a real save
        origin: c.origin === 'pre-save' ? null : (c.origin ?? null),
        _id: c._id || generateUUID(),
        dateAdded: currentDate,
    }));

    mutationQL.push(
        insertQl(COLLECTION_TYPE('collections_' + (mutationQL.length + 1)),{
            objects: objects
        })
    );
}

async function updateCollection(mutationQL, collections) {
    collections.map(c => {
        const collectionId = c._id;
        delete c._id;
        if (c?.origin === 'pre-save') {
            delete c.origin;
        }

        // An update must never move a row to another date: the page can send a stale dateAdded (e.g. a
        // transfer/tomorrow row loaded with the loan's original date) and rewriting it collides with the
        // loan's own row on that date (uix_cashCollections__loanId_dateAdded).
        // insertedDateTime is fixed at creation for the same reason: the page can send the loan's own insert time.
        const { dateAdded: _ignoredDateAdded, insertedDateTime: _ignoredInsertedDateTime, ...updateFields } = cleanUpCollection(c);

        mutationQL.push(
            updateQl(COLLECTION_TYPE('collections_' + (mutationQL.length + 1)), {
                set: {
                    ... updateFields,
                    origin: c.origin === 'offline' ? 'offline' : null,
                    reverted: null,
                },
                where: { _id: { _eq: collectionId } }
            })
        );
    });
}

async function updateLoan(user_id, mutationQL, collection, currentDate) {
    let loan = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
    logger.debug({user_id, page: `Saving Cash Collection - Updating Loan: ${collection.loanId}`});
    
    if (loan.length > 0) {
        loan = loan[0];

        // loans.remarks is varchar — parse it back to object for downstream checks
        if (loan.remarks && typeof loan.remarks === 'string') {
            try { loan.remarks = JSON.parse(loan.remarks); } catch (e) { loan.remarks = null; }
        }

        delete loan.groupStatus;
        loan.loanBalance = collection.loanBalance;
        loan.modifiedDateTime = new Date();

        if (collection?.revertedDate) {
            loan.revertedDateTime = collection.revertedDate;
        }

        if (collection.remarks && collection.remarks.value === 'matured-past due') {
            loan.activeLoan = 0;
            loan.maturedPD = true;
            loan.maturedPDDate = currentDate;
        }
        
        loan.amountRelease = collection.amountRelease;
        loan.noOfPayments = collection.noOfPayments !== '-' ? collection.noOfPayments : 0;
        loan.status = collection.status;
        loan.pastDue = collection.pastDue;
        loan.advanceDays = collection?.advanceDays ? collection.advanceDays : 0;

        loan.mcbuTarget = collection.mcbuTarget;
        loan.mcbu = collection.mcbu < 0 ? 0 : collection.mcbu;
        if (!loan.mcbuCollection || loan.mcbuCollection < 0) {
            loan.mcbuCollection = 0;
        }
        loan.mcbuCollection = loan.mcbuCollection ? loan.mcbuCollection + parseFloat(collection.mcbuCol) : parseFloat(collection.mcbuCol);

        if (!collection?.hasMcbuWithdrawal) {
            if (loan.occurence == 'daily' && collection.remarks) {
                if (collection.remarks.value == 'reloaner-wd') {
                    loan.mcbuWithdrawal = collection.mcbuWithdrawal;
                } else if (collection.remarks.value == 'reloaner-cont') {
                    loan.mcbuWithdrawal = 0;
                }
            } else {
                loan.mcbuWithdrawal = loan.mcbuWithdrawal ? loan.mcbuWithdrawal + parseFloat(collection.mcbuWithdrawal) : collection.mcbuWithdrawal ? parseFloat(collection.mcbuWithdrawal) : 0;
            }

            if (collection.mcbuWithdrawalFlag) {
                loan.mcbuWithdrawal = collection.mcbuWithdrawal;
            }
        }

        loan.csf = safeNumber(collection.csf);
        loan.csfCollection = safeNumber(loan.csfCollection) + safeNumber(collection.csfCollection);
        loan.csfWithdrawal = safeNumber(loan.csfWithdrawal) + safeNumber(collection.csfWithdrawal);
        loan.csfReturnAmt = safeNumber(loan.csfReturnAmt) + safeNumber(collection.csfReturnAmt);
        loan.csfIn = safeNumber(loan.csfIn) + safeNumber(collection.csfIn);

        if (collection.hasOwnProperty('mcbuInterest')) {
            loan.mcbuInterest = loan.mcbuInterest ? loan.mcbuInterest + collection.mcbuInterest : collection.mcbuInterest !== '-' ? collection.mcbuInterest : 0;
        }
        
        if (collection.remarks && collection.remarks.value === "past due") {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue + 1 : 1;
        } else {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue : 0;
        }

        if (collection.mcbuInterest > 0) {
            loan.mcbuInterest = collection.mcbuInterest;
        }

        if (collection.mcbuReturnAmt > 0) {
            loan.mcbuReturnAmt = collection.mcbuReturnAmt;
        } else {
            loan.mcbuReturnAmt = 0;
        }

        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        if (collection.hasOwnProperty('maturedPastDue')) {
            loan.maturedPastDue = collection.maturedPastDue;
            // Only matured-PD remarks clear the counter. The page sends maturedPastDue: 0 on
            // every remark, so Delinquent / Excused / Past Due must not hit this reset.
            const maturedRemarks = ['matured-past due', 'matured_past_due_collection', 'offset-matured-pd'];
            if (maturedRemarks.includes(collection.remarks?.value)) {
                loan.mispayment = 0;
            }
        }

        loan.history = collection.history;

        if (collection.loanBalance <= 0 || collection?.remarks?.value == 'offset-matured-pd') {
            loan.status = collection.status;
            if (collection.status === 'tomorrow') {
                loan.status = 'active';
            }
            
            loan.activeLoan = 0;
            if (!loan.fullPaymentDate) {    
                loan.fullPaymentDate = collection.fullPaymentDate;
            }
            
            loan.amountRelease = 0;
            // pastDue is always cleared (incl. Offset - Matured PD); only the past-due counter is kept for that remark
            loan.pastDue = 0;
            if (collection?.remarks?.value !== 'offset-matured-pd') {
                loan.noPastDue = 0;
            }

            if (collection.status == 'closed') {
                loan.loanCycle = 0;
                loan.remarks = collection.closeRemarks;
                loan.status = 'closed';
                loan.closedDate = currentDate;
                loan.dateModified = currentDate;
            }
        }

        // An offset closes the loan even while a balance remains, which skips the block above.
        // closedDate must still be stamped, otherwise the register's "today" query never lists it.
        if (collection.status === 'closed' && collection.loanBalance > 0) {
            loan.status = 'closed';
            loan.closedDate = currentDate;
            loan.dateModified = currentDate;
        }

        loan.lastUpdated = currentDate;

        // serialize back to string — loans.remarks column is varchar not jsonb
        if (loan.remarks && typeof loan.remarks === 'object') {
            loan.remarks = JSON.stringify(loan.remarks);
        }

        logger.debug({user_id, page: `Saving Cash Collection - Updating Loan`, data: loan});
        const loanId = loan._id;
        delete loan._id;

        mutationQL.push(
            updateQl(LOAN_TYPE('loans_' + (mutationQL.length + 1)), {
                set: {
                    ... assignNullValues(loan)
                },
                where: {
                    _id: { _eq: loanId }
                }
            })
        );

        return { success: true };
    }
}

async function updateLoanMcbuWithdrawal(user_id, mutationQL, collection) {
    let loan = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
    logger.debug({user_id, page: `Saving Cash Collection - Updating Loan Due to Withdrawal: ${collection.loanId}`});
    
    if (loan.length > 0) {
        loan = loan[0];
        delete loan.groupStatus;
        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        loan.mcbu = collection.mcbu;
        loan.mcbuWithdrawal = collection.mcbuWithdrawal;

        logger.debug({user_id, page: `Saving Cash Collection - Updating Loan Due to Withdrawal`, data: loan});
        const loanId = loan._id;
        delete loan._id;

        mutationQL.push(
            updateQl(LOAN_TYPE('loans_' + (mutationQL.length + 1)), {
                set: {
                    ... assignNullValues(loan)
                },
                where: {
                    _id: { _eq: loanId }
                }
            })
        );

        return { success: true };
    }
}

async function updateClient(user_id, mutationQl, loan) {
    let client = await graph.query(queryQl(CLIENT_TYPE('client'), { where: { _id: { _eq: loan.clientId } } })).then(res => res.data.client);
    
    if (client.length > 0) {
        client = client[0];
        client.status = loan.clientStatus;

        // loan.remarks may still be a varchar string at this point — parse safely
        const loanRemarks = (loan.remarks && typeof loan.remarks === 'string')
            ? (() => { try { return JSON.parse(loan.remarks); } catch (e) { return null; } })()
            : loan.remarks;

        if (client.status === 'offset') {
            // Only remember the previous group/LO when the client still has one. A re-save of an
            // already-offset client (e.g. a second Save Draft) must not overwrite oldGroupId/oldLoId
            // with null, otherwise rollback can never restore the client.
            if (client.groupId || client.loId) {
                client.oldLoId = client.loId;
                client.oldGroupId = client.groupId;
            }
            client.groupId = null;
            client.loId = null;
        }

        if ((loanRemarks && loanRemarks.value?.startsWith('delinquent') && loan.delinquent)) {
            client.delinquent = true;
        }

        mutationQl.push(
            updateQl(CLIENT_TYPE('clients_' + (mutationQl.length + 1)), {
                set: {
                    ... assignNullValues(client, 'client')
                },
                where: {
                    _id: { _eq: loan.clientId }
                }
            })
        );
        
        if (loanRemarks && loanRemarks.value?.startsWith('offset')) {
            await updateGroup(user_id, mutationQl, loan);
        }
    }
}

async function updateGroup(user_id, mutationQl, loan) {
    let group = await graph.query(
        queryQl(GROUP_TYPE('groups'), {where: { _id: { _eq: loan.groupId } }})
    ).then(res => res.data.groups);

    if (group.length > 0) {
        group = group[0];

        if (group.status === 'full') {
            group.status = 'available';
        }

        const slotNo = parseInt(loan.slotNo);
        if (!group.availableSlots) {
            group.availableSlots = [];
        }
        
        if (!group.availableSlots.includes(slotNo)) {
            group.availableSlots.push(slotNo);
            group.availableSlots.sort((a, b) => a - b);
            group.noOfClients = group.noOfClients - 1;
        } else {
            const index = group.availableSlots.indexOf(slotNo);
            if (index > -1) {
                group.availableSlots.splice(index, 1);
                group.availableSlots.sort((a, b) => a - b);
                group.noOfClients = group.noOfClients + 1;
            }
        }

        delete group._id;

        mutationQl.push(
            updateQl(GROUP_TYPE('groups_' + (mutationQl.length + 1)), {
                set: {
                    ... group
                },
                where: {
                    _id: { _eq: loan.groupId }
                }
            })
        );
    }
}

async function updateDenomination(mutationQl, groupId, currentDate, overallTotalNetCollection) {
    let denomination = await graph.query(
        queryQl(DENOMINATION_TYPE('denomination'), {where: { group_id: { _eq: groupId }, date_added: { _eq: currentDate } }})
    ).then(res => res.data.denomination);

    if (denomination && denomination.length > 0) {
        denomination = denomination[0];
        const history = denomination.history ? [...denomination.history] : [];
        
        if (history.length > 0) {
            let needsUpdate = false;
            const latestHistory = history[history.length - 1];
            const denominationId = denomination._id;
            delete denomination._id;
            
            if (latestHistory.total_net_collection !== overallTotalNetCollection && overallTotalNetCollection > 0) {
                denomination.bcc_vs_remittances = overallTotalNetCollection;
                denomination.synced = false;
                needsUpdate = true;
            } else {
                denomination.bcc_vs_remittances = overallTotalNetCollection;
                denomination.synced = true;
                needsUpdate = true;
            }

            if (needsUpdate) {
                mutationQl.push(
                    updateQl(DENOMINATION_TYPE('denomination_' + (mutationQl.length + 1)), {
                        set: {
                            ... denomination
                        },
                        where: {
                            _id: { _eq: denominationId }
                        }
                    })
                );
            }
        }
    }
}