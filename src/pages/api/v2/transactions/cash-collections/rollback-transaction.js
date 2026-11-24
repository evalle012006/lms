import { CASH_COLLECTIONS_FIELDS, LOAN_FIELDS, QR_CASH_COLLECTION_ENTRY_FIELDS } from '@/lib/graph.fields';
import { findClients, findGroups, findLoans, findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/date-utils';
import { logAudit } from '@/lib/audit';
import { buildRevertAuditEvents } from '@/lib/audit-lor';
import logger from '@/logger';
import moment from 'moment';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `${CASH_COLLECTIONS_FIELDS}`);
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`);
const QR_ENTRY_TYPE = createGraphType('qr_cash_collection_entries', `${QR_CASH_COLLECTION_ENTRY_FIELDS}`);

export default apiHandler({
    post: revert,
});

// Single place that writes the response, so it can never be written twice.
function send(res, statusCode, body) {
    return res
        .status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(body));
}

// A loan is "pending, cycle 1" when it is a brand-new loan with nothing to roll back to.
function resolveLoanId(cc) {
    return (cc.status === 'pending' || cc.status === 'tomorrow') ? cc.prevLoanId : cc.loanId;
}

async function revert(req, res) {
    const user_id = req?.auth?.sub;
    const cashCollections = req.body;
    const mutationQL = [];
    const groupCache = {};
    const blockedItems = []; // records that cannot be reverted; fails the whole request
    const skippedItems = []; // records intentionally not reverted (reported back, never silent)
    const keptPendingLoans = []; // pending new loans that stay; the page must confirm first
    const revertedRows = []; // rows whose revert was queued; audited after the mutation succeeds
    const confirmed = req.query?.confirmed === 'true';

    try {
        if (!Array.isArray(cashCollections) || cashCollections.length === 0) {
            return send(res, 200, { success: false, error: true, message: 'No transactions provided.' });
        }

        // ── BM limit: resolve requesting user's role ──────────────────────
        const requestingUser = await findUserById(user_id);
        const isBranchManager = requestingUser?.role?.rep === 3;

        // ── Pre-flight BM limit check (before touching any mutations) ─────
        if (isBranchManager) {
            const allLoanIds = cashCollections.map(resolveLoanId).filter(Boolean);
            const loans = await findLoans({ _id: { _in: [...new Set(allLoanIds)] } });
            const blocked = loans.some(l => (l.bmRevertCount || 0) >= 1);

            if (blocked) {
                return send(res, 200, {
                    success: false,
                    error: true,
                    message: 'Branch manager has already used their one-time revert for this slot. Only a higher-level manager can revert this transaction.'
                });
            }
        }

        for (const cashCollection of cashCollections) {
            const loanId = resolveLoanId(cashCollection);

            if (!loanId) {
                // never skip silently: a row without a loan reference cannot be rolled back
                blockedItems.push({
                    cashCollectionId: cashCollection._id,
                    clientId: cashCollection.clientId,
                    reason: 'No loan reference on the transaction.'
                });
                continue;
            }

            logger.debug({
                user_id,
                page: `Reverting Transaction Loan: ${cashCollection.clientId}`,
                data: cashCollection
            });

            // graph.query throws on GraphQL errors, so no `.errors` check is needed here.
            const loanHistoryResult = await graph.query(
                queryQl(createGraphType('loans_history', `_id data created_dt`)('loan_history'), {
                    where: { loan_id: { _eq: loanId } },
                    limit: 10,
                    order_by: [{ created_dt: 'desc' }]
                })
            );

            const snapshots = loanHistoryResult.data?.loan_history ?? [];

            // Reverting a closed / offset row must restore the loan as it was BEFORE it was closed.
            // A snapshot is taken at the start of every save, so a loan that was saved again after it
            // closed has a newest snapshot that is already closed. Restoring that one deletes the
            // cashCollections row and leaves the loan closed (HONDA slots 1 and 5, 2026-11-16).
            const isClosedRevert = cashCollection.status == 'closed';
            const loan_history = isClosedRevert
                ? snapshots.find(h => h?.data && h.data.status !== 'closed' && !h.data.closedDate)
                : snapshots[0];

            if (!loan_history?.data) {
                blockedItems.push({
                    cashCollectionId: cashCollection._id,
                    loanId,
                    clientId: cashCollection.clientId,
                    reason: isClosedRevert
                        ? 'No loan snapshot from before the loan was closed. Reverting would leave the loan closed.'
                        : 'No loan history snapshot found to restore from.'
                });
                continue;
            }

            const [currentLoan] = await findLoans({ _id: { _eq: loanId } });

            if (!currentLoan) {
                blockedItems.push({
                    cashCollectionId: cashCollection._id,
                    loanId,
                    clientId: cashCollection.clientId,
                    reason: 'Loan not found.'
                });
                continue;
            }

            // New loan should be ignored in rollback
            if (currentLoan.status == 'pending' && currentLoan.loanCycle == 1) {
                skippedItems.push({
                    cashCollectionId: cashCollection._id,
                    loanId,
                    clientId: cashCollection.clientId,
                    reason: 'New loan (cycle 1, pending) has nothing to roll back.'
                });
                continue;
            }

            // The new (reloan) loan decides what may be reverted, not cc.status.
            // An approved new loan has been released (photo, SMS, cash out): reverting it
            // would delete a released loan or leave two live loans (2026-11-24 incident).
            const successorOr = [{ prevLoanId: { _eq: loanId } }];
            if (cashCollection.loanId) successorOr.push({ _id: { _eq: cashCollection.loanId } });
            const successors = await findLoans({
                _and: [
                    { _or: successorOr },
                    { _id: { _neq: loanId } },
                    { status: { _neq: 'reject' } },
                ],
            });

            const label = `${cashCollection.fullName ?? cashCollection.clientId}${cashCollection.slotNo ? ` (slot ${cashCollection.slotNo})` : ''}`;
            const approvedSuccessor = successors.find(l => l.status !== 'pending');
            if (approvedSuccessor) {
                blockedItems.push({
                    code: 'NEW_LOAN_APPROVED',
                    cashCollectionId: cashCollection._id,
                    loanId,
                    newLoanId: approvedSuccessor._id,
                    clientId: cashCollection.clientId,
                    branchId: cashCollection.branchId,
                    label,
                    reason: `${label}: the new loan is already approved and released.`
                });
                continue;
            }

            // A pending new loan is never deleted: it stays pending and the page confirms first.
            const pendingSuccessor = successors.find(l => l.status === 'pending');
            if (pendingSuccessor) {
                keptPendingLoans.push({
                    clientId: cashCollection.clientId,
                    branchId: cashCollection.branchId,
                    loanId: pendingSuccessor._id,
                    label,
                    ldfApproved: !!pendingSuccessor.ldfApproved
                });
            }

            // The cash collection being deleted must really exist, otherwise the revert would
            // silently leave it behind while the loan/client are restored.
            const existingCc = await graph.query(
                queryQl(CASH_COLLECTION_TYPE('cc_exists'), { where: { _id: { _eq: cashCollection._id } }, limit: 1 })
            ).then(r => r.data?.cc_exists ?? []);

            if (existingCc.length === 0) {
                blockedItems.push({
                    cashCollectionId: cashCollection._id,
                    loanId,
                    clientId: cashCollection.clientId,
                    reason: 'Cash collection record not found (already reverted or changed).'
                });
                continue;
            }

            // A closed group transaction is read-only: it must be reopened before anything is reverted.
            if (existingCc[0].groupStatus === 'closed') {
                blockedItems.push({
                    cashCollectionId: cashCollection._id,
                    loanId,
                    clientId: cashCollection.clientId,
                    reason: 'The group transaction is closed. Reopen it before reverting.'
                });
                continue;
            }

            // Client and group are only needed when the collection was closed
            // (client is moved back to the old group and the slot is re-taken).
            let client = null;
            let group = null;

            const [clientNow] = await findClients({ _id: { _eq: loan_history.data.clientId } });
            const restoreClient = cashCollection.status == 'closed' || clientNow?.status === 'offset';

            if (restoreClient) {
                client = clientNow;
                [group] = await findGroups({ _id: { _eq: loan_history.data.groupId } });

                if (!client || !group) {
                    blockedItems.push({
                        cashCollectionId: cashCollection._id,
                        loanId,
                        clientId: cashCollection.clientId,
                        reason: !client ? 'Client not found.' : 'Group not found.'
                    });
                    continue;
                }

                if (!groupCache[group._id]) {
                    groupCache[group._id] = { groupId: group._id, slots: [] };
                }
            }

            // Delete cash collection
            mutationQL.push(
                deleteQl(
                    CASH_COLLECTION_TYPE(`cash_collection_${mutationQL.length}`),
                    { _id: { _eq: cashCollection._id } }
                )
            );

            // Delete merged QR entries
            mutationQL.push(
                deleteQl(
                    QR_ENTRY_TYPE(`qr_delete_${mutationQL.length}`),
                    { mergedIntoCashCollectionId: { _eq: cashCollection._id } }
                )
            );

            // The new loan is never deleted here: a pending one stays pending, an approved one was blocked above.

            revertedRows.push(cashCollection);

            const prevLoanData = {
                ...loan_history.data,
                reverted: true,
                revertedDateTime: new Date(),
                // Stamp BM revert count
                bmRevertCount: isBranchManager
                    ? (currentLoan.bmRevertCount || 0) + 1
                    : (currentLoan.bmRevertCount || 0),
            };

            if (cashCollection?.mcbuWithdrawalId) {
                prevLoanData.mcbu = prevLoanData.mcbu + prevLoanData.mcbuWithdrawal;
                prevLoanData.mcbuWithdrawal = 0;
            }

            if (cashCollection?.csfWithdrawalId) {
                prevLoanData.csf = prevLoanData.csf + prevLoanData.csfWithdrawal;
                prevLoanData.csfWithdrawal = 0;
            }

            // Delete loan history
            mutationQL.push(
                deleteQl(
                    createGraphType('loans_history', `_id`)(`loan_history_${mutationQL.length}`),
                    isClosedRevert
                        // also drop the closed-state snapshots taken after it, or the next revert restores them
                        ? { loan_id: { _eq: loanId }, created_dt: { _gte: loan_history.created_dt } }
                        : { _id: { _eq: loan_history._id } }
                )
            );

            // Delete mcbu withdrawal transaction
            if (cashCollection?.mcbuWithdrawalId) {
                mutationQL.push(
                    deleteQl(
                        createGraphType('mcbu_withdrawals', `_id`)(`mcbu_withdrawals_${mutationQL.length}`),
                        { _id: { _eq: cashCollection.mcbuWithdrawalId } }
                    )
                );
            }

            // Update client if cashCollection is closed (or the client is still flagged offset)
            if (restoreClient) {
                groupCache[group._id].slots.push(cashCollection.slotNo);
                mutationQL.push(
                    updateQl(
                        createGraphType('client', `_id`)(`client_${mutationQL.length}`),
                        {
                            set: {
                                // fall back to the loan snapshot when oldGroupId/oldLoId were lost
                                groupId: client.oldGroupId ?? loan_history.data.groupId ?? null,
                                loId: client.oldLoId ?? loan_history.data.loId ?? null,
                                // offset/closed clients return to active
                                status: client.status === 'offset' ? 'active' : client.status,
                                oldGroupId: null,
                                oldLoId: null
                            },
                            where: { _id: { _eq: client._id } }
                        }
                    )
                );
            }

            // Update loan with history data
            mutationQL.push(
                updateQl(
                    LOAN_TYPE(`loan_${mutationQL.length}`),
                    {
                        set: { ...prevLoanData },
                        where: { _id: { _eq: loanId } }
                    }
                )
            );
        }

        // ── Fail the whole request if any record could not be reverted ────
        // Nothing has been mutated yet, so this is safe and avoids silent partial reverts.
        if (blockedItems.length > 0) {
            logger.error({
                user_id,
                page: 'Rollback Transaction Blocked',
                data: blockedItems
            });

            const approvedBlocks = blockedItems.filter(b => b.code === 'NEW_LOAN_APPROVED');
            blockedItems.slice(0, 50).forEach(b => logAudit(req, {
                action: b.code === 'NEW_LOAN_APPROVED' ? 'LOR_REVERT_BLOCKED_APPROVED_LOAN' : 'LOR_REVERT_BLOCKED',
                category: 'COLLECTION',
                severity: 'WARNING',
                entityType: 'cashCollection',
                entityId: b.cashCollectionId,
                clientId: b.clientId,
                branchId: b.branchId,
                description: `Revert refused: ${b.reason}`,
                success: false,
                failReason: b.reason,
                metadata: { loanId: b.loanId, newLoanId: b.newLoanId ?? null, code: b.code ?? null },
            }));

            return send(res, 200, {
                success: false,
                error: true,
                message: approvedBlocks.length > 0
                    ? 'Cannot revert: the new loan is already approved and released. Contact an administrator.'
                    : 'Cannot revert: one or more records have no restorable history.',
                details: blockedItems
            });
        }

        // Pending new loans are kept, not deleted. Ask the page to confirm before rolling back.
        if (keptPendingLoans.length > 0 && !confirmed) {
            const ldf = keptPendingLoans.some(k => k.ldfApproved);
            return send(res, 200, {
                success: false,
                requiresConfirmation: true,
                message: `The current transaction will be rolled back. The pending loan for ${keptPendingLoans.map(k => k.label).join(', ')} is kept, not deleted.`
                    + (ldf ? ' Its LDF approval is also kept; un-approve it first if it should not stay approved.' : ''),
                details: keptPendingLoans
            });
        }

        if (mutationQL.length === 0) {
            return send(res, 200, { success: true, message: 'No valid records to revert', skipped: skippedItems });
        }

        for (const group of Object.values(groupCache)) {
            if (group.slots.length) {
                await updateGroup(mutationQL, group.groupId, group.slots);
            }
        }

        const result = await graph.mutation(...mutationQL);

        // Audit only after the mutation succeeded. Never let audit break a revert.
        try {
            const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
            buildRevertAuditEvents(revertedRows, { currentDate }).forEach(e => logAudit(req, e));
            keptPendingLoans.forEach(k => logAudit(req, {
                action: 'LOR_REVERT_PENDING_LOAN_KEPT',
                category: 'COLLECTION',
                severity: 'INFO',
                entityType: 'loan',
                entityId: k.loanId,
                clientId: k.clientId,
                branchId: k.branchId,
                description: `Transaction rolled back; pending loan ${k.loanId} kept (not deleted)`,
                metadata: { ldfApproved: k.ldfApproved, currentDate },
            }));
        } catch (e) { /* audit must never break a revert */ }

        return send(res, 200, { success: true, data: result?.data, skipped: skippedItems });

    } catch (error) {
        console.error(error);
        logger.error({
            user_id,
            page: 'Rollback Transaction Error',
            error: error.message,
            stack: error.stack
        });

        try {
            logAudit(req, {
                action: 'LOR_REVERT_FAILED',
                category: 'COLLECTION',
                severity: 'CRITICAL',
                entityType: 'cashCollection',
                entityId: Array.isArray(cashCollections) ? cashCollections[0]?._id ?? null : null,
                description: `Revert failed for ${Array.isArray(cashCollections) ? cashCollections.length : 0} row(s)`,
                success: false,
                failReason: error.message,
                metadata: { cashCollectionIds: Array.isArray(cashCollections) ? cashCollections.map(c => c._id).slice(0, 200) : [] },
            });
        } catch (e) { /* ignore */ }

        return send(res, 500, { success: false, error: error.message });
    }
}

async function updateGroup(mutationQl, groupId, slots) {
    const [group] = await findGroups({ _id: { _eq: groupId } });

    if (!group) {
        throw new Error(`Group ${groupId} not found while restoring slots.`);
    }

    const availableSlots = group.availableSlots.filter(s => !slots.includes(s));
    const noOfClients = group.noOfClients + slots.length;

    mutationQl.push(
        updateQl(
            createGraphType('groups', `_id`)(`groupst_${mutationQl.length}`),
            {
                // Only the fields this revert owns; do not write back the whole row.
                set: {
                    availableSlots,
                    noOfClients,
                    status: noOfClients >= group.capacity ? 'full' : 'available'
                },
                where: { _id: { _eq: groupId } }
            }
        )
    );
}