import { CASH_COLLECTIONS_FIELDS, BRANCH_APPROVAL_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import moment from 'moment';
import { notifyTransactionClosed, notifyBranchTransactionApproved, isNotificationEnabled } from '@/lib/notification-service';
import { findBranches, findUserById } from '@/lib/graph.functions';
// ADDED: shared list of required closing document types
import { CLOSING_DOC_KEYS } from '@/lib/closing-documents.constants';

let response = {};
let statusCode = 200;

const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `_id`)('collections');
const BRANCH_APPROVAL_TYPE = createGraphType('branchApprovals', `_id`)('approvals');
const graph = new GraphProvider();

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

export default apiHandler({
    post: processGroupTransactionStatus,
    get: getLOSummary
});

async function processGroupTransactionStatus(req, res) {
    const { loId, branchId, mode, currentDate, currentTime, transactionType, userId, userName, isAdmin } = req.body;

    // Determine if this is a branch-level or LO-level operation
    const isBranchLevel = !!branchId && !loId;
    const isNotificationEnabledFlag = await isNotificationEnabled();

    if (isBranchLevel) {
        // ADDED: authoritative server-side role check, using the
        // authenticated session (req.auth.sub) — not req.body.userId, which
        // is client-supplied and could name any user regardless of who's
        // actually logged in.
        const requestingUser = await findUserById(req.auth?.sub);
        if (!isAuthorizedForBranchClose(requestingUser?.role)) {
            response = { error: true, message: "You are not authorized to open or close branch transactions." };
            statusCode = 403;
        } else {
            // BRANCH-LEVEL APPROVAL
            await processBranchApproval(branchId, currentDate, mode, userId, userName, isAdmin, isNotificationEnabledFlag);
        }
    } else if (loId) {
        // LO-LEVEL APPROVAL (existing logic)
        await processLOApproval(loId, branchId, currentDate, currentTime, mode, transactionType, isAdmin, isNotificationEnabledFlag, userName);
    } else {
        response = { error: true, message: "Either Branch ID or Loan Officer ID is required." };
        statusCode = 400;
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function processBranchApproval(branchId, dateFor, mode, userId, userName, isAdmin = false, isNotificationEnabledFlag) {
    try {
        // Before closing, verify all LO transactions for this branch are closed
        // Allow admins to bypass this check
        if (mode === 'close' && !isAdmin) {
            const unclosedTransactions = await checkBranchTransactionStatus(branchId, dateFor);
            
            if (unclosedTransactions.length > 0) {
                response = { 
                    error: true, 
                    message: "Cannot approve branch. Some Loan Officers still have open or pending transactions. All LO transactions must be closed first." 
                };
                return;
            }

            // FIXED: Check for pending fund transfers at branch level
            const pendingFundTransfers = await checkBranchFundTransfers(branchId, dateFor);
            
            if (pendingFundTransfers.length > 0) {
                response = {
                    error: true,
                    message: "Cannot approve branch. There are pending Fund Transfers. Please check and approve or contact Finance Admin."
                };
                return;
            }

            // ADDED: Require all 5 branch closing documents before allowing close.
            // Client-side (branch-check.js) enforces this too for UX, but this is
            // the authoritative server-side gate — never trust the client alone.
            const missingDocTypes = await checkMissingClosingDocuments(branchId, dateFor);

            if (missingDocTypes.length > 0) {
                response = {
                    error: true,
                    message: `Cannot approve branch. Missing closing documents: ${missingDocTypes.join(', ')}`
                };
                return;
            }

            // ADDED: require all 5 documents to be acknowledged BY THE
            // PERSON FINALIZING (userId), matched to their currently active
            // version. This is the authoritative gate for the review
            // checkboxes — the modal disabling "Confirm final closing" is
            // UX only, exactly like the document-presence check above.
            const unacknowledgedDocTypes = await checkUnacknowledgedClosingDocuments(branchId, dateFor, userId);

            if (unacknowledgedDocTypes.length > 0) {
                response = {
                    error: true,
                    message: `Cannot approve branch. You must review and acknowledge: ${unacknowledgedDocTypes.join(', ')}`
                };
                return;
            }
        }

        // Handle branch approval
        const approvalResult = await handleBranchApproval(branchId, dateFor, mode, userId, userName);
        
        if (approvalResult.success) {
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
                    console.error('Failed to create branch approval notification:', notifError.message);
                }
            }

            const actionText = mode === 'close' ? 'locked and approved' : 'unlocked';
            const adminNote = isAdmin ? ' (Admin override)' : '';
            response = { 
                success: true, 
                message: `Branch has been ${actionText} successfully.${adminNote}` 
            };
            statusCode = 200;
        } else {
            response = approvalResult;
            statusCode = 400;
        }
    } catch (error) {
        console.error('Error processing branch approval:', error);
        response = { error: true, message: "Error processing branch approval." };
        statusCode = 500;
    }
}

async function processLOApproval(loId, branchId, currentDate, currentTime, mode, transactionType, isAdmin = false, isNotificationEnabledFlag, userName) {
    const dayName = moment(currentDate).format('dddd').toLowerCase();
    const cashCollectionCounts = await checkLoTransactions(loId, currentDate, dayName, transactionType);

    if (cashCollectionCounts) {
        // Only run these validations if NOT admin
        if (!isAdmin && mode === 'close') {
            const noCollections = cashCollectionCounts.filter(cc => { 
                if (cc.cashCollections.length === 0) {
                    return cc;
                }
            });
            const hasDrafts = cashCollectionCounts.filter(cc => { 
                if (cc.cashCollections.length > 0 && cc.cashCollections[0].hasDrafts > 0) {
                    return cc;
                }
            });

            const hasClosingTime = cashCollectionCounts.filter(cc => { 
                if (cc.cashCollections.length > 0 && cc.cashCollections[0].hasClosingTime.length > 0) {
                    return cc;
                }
            });

            const hasPendingMcbuWithdrawals = cashCollectionCounts.filter(cc => cc.mcbuw_count > 0);
            const hasPendingFundTransfers = cashCollectionCounts.filter(cc => cc.ft_count > 0);
            const hasPendingDenominations = cashCollectionCounts.filter(cc => cc.denom_count > 0);
            const noDenominationTransactions = cashCollectionCounts.filter(cc => cc.denom === 0); 
            const validNoDenominationTransactions = cashCollectionCounts.filter(cc => {
                const currentCc = cc.cashCollections[0];
                const totalNetCollection = currentCc ? currentCc.totalNetCollection : 0;
                const tda = currentCc ? currentCc.tda : 0;
                const goodExcused = currentCc ? currentCc.goodExcused : 0;
                const pastDue = currentCc ? currentCc.pastDue : 0;
                const maturedPd = currentCc ? currentCc.maturedPd : 0;
                const mispayments = currentCc ? currentCc.mispayments + tda + goodExcused + maturedPd + pastDue : 0;
                if (cc.denom === 0 && cc.cashCollections.length > 0 
                    && currentCc.count > 0
                    && mispayments > 0
                    && currentCc.count !== mispayments
                    && totalNetCollection > 0) {
                    return cc;
                }
            });

            // 1. Get a Set of IDs from the complex filter (validNoDenominationTransactions)
            //    Set lookups are highly efficient (O(1)).
            const validIds = new Set(validNoDenominationTransactions.map(cc => cc._id));

            // 2. Check if any item from the simple filter exists in the complex filter's ID set.
            const hasIntersection = noDenominationTransactions.some(cc => validIds.has(cc._id));

            let finalNoDenominationTransactions;
            let finalValidNoDenominationTransactions;

            if (hasIntersection) {
                // If there is at least one common item, keep both lists as they are
                finalNoDenominationTransactions = noDenominationTransactions;
                finalValidNoDenominationTransactions = validNoDenominationTransactions;
            } else {
                // If there is NO common item, empty both lists
                finalNoDenominationTransactions = [];
                finalValidNoDenominationTransactions = [];
            }
            
            const hasPendingLoans = cashCollectionCounts.filter(cc => cc.pending_count > 0);

            if (noCollections.length > 0) {
                response = { error: true, message: "Some groups have no current transactions for the selected Loan Officer." };
                return;
            } else if (hasDrafts.length > 0) {
                response = { error: true, message: "Some groups have draft transactions for the selected Loan Officer." };
                return;
            } else if (hasPendingMcbuWithdrawals.length > 0) {
                response = { error: true, message: "Some groups have pending MCBU withdrawals for the selected Loan Officer. Please reject or delete them." };
                return;
            } else if (hasPendingFundTransfers.length > 0) {
                // FIXED: Enhanced error message to be more specific
                response = { error: true, message: "Branch has pending Fund Transfer(s). Please check and approve or contact Finance Admin." };
                return;
            } else if (finalNoDenominationTransactions.length > 0 || finalValidNoDenominationTransactions.length > 0) {
                response = { error: true, message: "LO has no Denomination entries. Please check and add them." };
                return;
            } else if (hasPendingDenominations.length > 0) {
                response = { error: true, message: "LO has pending or not balanced Denomination entries. Please check and approve or contact Cashier." };
                return;
            } else if (hasPendingLoans.length > 0) {
                response = { error: true, message: "LO has pending Loan entries. Please check and approve or contact Branch Manager." };
                return;
            }

            // FIXED: Additional check for branch-level fund transfers
            // This catches fund transfers that might not be in the group-level query
            if (branchId) {
                const branchFundTransfers = await checkBranchFundTransfers(branchId, currentDate);
                if (branchFundTransfers.length > 0) {
                    response = { 
                        error: true, 
                        message: "Branch has pending Fund Transfer(s). Please check and approve or contact Finance Admin." 
                    };
                    return;
                }
            }
        }

        // Get hasClosingTime for the update logic
        const hasClosingTime = cashCollectionCounts.filter(cc => { 
            if (cc.cashCollections.length > 0 && cc.cashCollections[0].hasClosingTime.length > 0) {
                return cc;
            }
        });

        let result;
        if (mode === 'close' && hasClosingTime.length === 0) {
            result = await graph.mutation(
                updateQl(CASH_COLLECTION_TYPE, {
                    set: {
                        groupStatus: 'closed',
                        closingTime: currentTime
                    },
                    where: {
                        loId: { _eq: loId },
                        dateAdded: { _eq: currentDate }
                    }
                })
            );
        } else {
            result = await graph.mutation(
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
            );
        }

        if (result.data.collections.affected_rows === 0) {
            response = { error: true, message: "No transactions found for this Loan Officer." };
        } else {
            // ADDED: If an LO transaction is reopened after the branch was already
            // closed for this date, flag the branch's uploaded closing documents as
            // stale rather than touching branchApprovals.status. Status stays
            // 'closed' by design — reopening one LO does not unlock branch-level
            // records or re-run the full precondition chain.
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
                    console.error('Failed to create LO transaction close notification:', notifError.message);
                }
            }

            const adminNote = isAdmin ? ' (Admin override)' : '';
            response = { 
                success: true,
                message: `Transactions updated successfully.${adminNote}`
            };
        }
    } else {
        response = { error: true, message: "Error checking Loan Officer transactions." };
    }
}

async function handleBranchApproval(branchId, dateFor, mode, userId, userName) {
    try {
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
                const result = await graph.mutation(
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
                );

                if (result.data.approvals.affected_rows > 0) {
                    return { success: true };
                } else {
                    return { error: true, message: "Failed to update branch approval." };
                }
            } else {
                // Create new record
                const result = await graph.mutation(
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
                );

                if (result.data.approvals.affected_rows > 0) {
                    return { success: true };
                } else {
                    return { error: true, message: "Failed to create branch approval." };
                }
            }
        } else {
            // mode === 'open'
            // ADDED: was this branch previously closed? Only matters in
            // that case — reopening an already-open branch has nothing to
            // reset. Captured before the update below overwrites status.
            const wasClosed = approval?.status === 'closed';

            if (approval) {
                // Update existing record
                const result = await graph.mutation(
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
                );

                if (result.data.approvals.affected_rows > 0) {
                    // ADDED: same reset as the LO-level reopen path — a
                    // direct branch-level reopen is at least as consequential
                    // as reopening a single LO, so it must invalidate prior
                    // acknowledgments too. Previously this path had no reset
                    // at all, meaning re-closing after a full branch reopen
                    // would silently reuse stale sign-offs.
                    if (wasClosed) {
                        await graph.mutation(
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
                    return { success: true };
                } else {
                    return { error: true, message: "Failed to update branch approval." };
                }
            } else {
                // Create new record with 'open' status
                const result = await graph.mutation(
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
                );

                if (result.data.approvals.affected_rows > 0) {
                    return { success: true };
                } else {
                    return { error: true, message: "Failed to create branch approval." };
                }
            }
        }
    } catch (error) {
        console.error('Error handling branch approval:', error);
        return { error: true, message: "Error processing branch approval." };
    }
}

async function checkBranchTransactionStatus(branchId, currentDate) {
    try {
        // Get all cash collections for this branch that are NOT closed
        const unclosedCollections = await graph.query(
            queryQl(
                createGraphType('cashCollections', `
                    _id
                    loId
                    groupId
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
    } catch (error) {
        console.error('Error checking branch transaction status:', error);
        throw error;
    }
}

/**
 * FIXED: New function to check for pending fund transfers at branch level
 * This provides a comprehensive check for all fund transfer scenarios
 */
async function checkBranchFundTransfers(branchId, currentDate) {
    try {
        console.log(`Checking fund transfers for branch ${branchId} on ${currentDate}`);
        
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
            console.log(`Found ${transfers.length} pending fund transfer(s) for branch ${branchId}:`, 
                transfers.map(t => ({
                    id: t._id,
                    status: t.status,
                    giverApprovalStatus: t.giverApprovalStatus,
                    receiverApprovalStatus: t.receiverApprovalStatus
                }))
            );
        }

        return transfers;
    } catch (error) {
        console.error('Error checking branch fund transfers:', error);
        throw error;
    }
}

/**
 * ADDED: Returns the doc types from CLOSING_DOC_KEYS that do NOT have an
 * active (isActive: true) row for this branch/date. Empty array = complete.
 */
async function checkMissingClosingDocuments(branchId, dateFor) {
    try {
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
    } catch (error) {
        console.error('Error checking closing documents:', error);
        throw error;
    }
}

/**
 * ADDED: Returns the doc types not yet acknowledged BY THIS SPECIFIC
 * USER, matched against each document's currently active version — a
 * re-upload bumps the version and correctly un-acknowledges it, since
 * the old review row simply won't match anymore.
 */
async function checkUnacknowledgedClosingDocuments(branchId, dateFor, userId) {
    try {
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
    } catch (error) {
        console.error('Error checking document acknowledgments:', error);
        throw error;
    }
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
        await graph.mutation(
            updateQl(
                createGraphType('closing_document_reviews', `_id`)('reviews'),
                {
                    set: {
                        acknowledged: false,
                        acknowledged_at: null,
                    },
                    where: {
                        branch_id: { _eq: branchId },
                        date_for: { _eq: currentDate },
                        acknowledged: { _eq: true },
                    },
                },
            ),
        );
    } catch (error) {
        // Don't fail the LO reopen just because the stale-flag write failed —
        // log and move on, but this is worth alerting on if it happens often.
        console.error('Error flagging branch documents stale:', error);
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
    const ids = groupIds.split(',');

    const groups = await graph.query(
        queryQl(createGraphType('cashCollections', `${CASH_COLLECTIONS_FIELDS}`)('collections'), {
            where: { 
                groupId: { _in: ids },
                dateAdded: { _eq: currentDate }
            }
        })
    ).then(res => res.data.collections);

    response = { success: true, data: groups }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}