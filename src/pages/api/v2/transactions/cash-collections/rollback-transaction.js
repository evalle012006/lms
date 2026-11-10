import { CASH_COLLECTIONS_FIELDS, LOAN_FIELDS, QR_CASH_COLLECTION_ENTRY_FIELDS } from '@/lib/graph.fields';
import { findClients, findGroups, findLoans, findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import logger from '@/logger';
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
                continue;
            }

            logger.debug({
                user_id,
                page: `Reverting Transaction Loan: ${cashCollection.clientId}`,
                data: cashCollection
            });

            // graph.query throws on GraphQL errors, so no `.errors` check is needed here.
            const loanHistoryResult = await graph.query(
                queryQl(createGraphType('loans_history', `_id data`)('loan_history'), {
                    where: { loan_id: { _eq: loanId } },
                    limit: 1,
                    order_by: [{ created_dt: 'desc' }]
                })
            );

            const loan_history = loanHistoryResult.data?.loan_history?.[0];

            if (!loan_history?.data) {
                blockedItems.push({
                    cashCollectionId: cashCollection._id,
                    loanId,
                    clientId: cashCollection.clientId,
                    reason: 'No loan history snapshot found to restore from.'
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
                continue;
            }

            // Client and group are only needed when the collection was closed
            // (client is moved back to the old group and the slot is re-taken).
            let client = null;
            let group = null;

            if (cashCollection.status == 'closed') {
                [client] = await findClients({ _id: { _eq: loan_history.data.clientId } });
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

                // CHANGE: the snapshot is taken BEFORE a save applies. A snapshot that is already
                // 'closed' means a save ran twice (retry/duplicate). Restoring it would not undo the close.
                if (loan_history.data.status === 'closed') {
                    blockedItems.push({
                        cashCollectionId: cashCollection._id,
                        loanId,
                        clientId: cashCollection.clientId,
                        reason: 'Latest snapshot is already closed; restoring it would not undo the close. Check loans_history for a duplicate snapshot.'
                    });
                    continue;
                }

                // CHANGE: the slot may have been given to another client since the offset.
                const restoredSlotNo = loan_history.data.slotNo ?? cashCollection.slotNo;
                const [slotTaken] = await findLoans({
                    _id: { _neq: loanId },
                    groupId: { _eq: group._id },
                    slotNo: { _eq: restoredSlotNo },
                    status: { _in: ['active', 'pending'] },
                    clientId: { _neq: loan_history.data.clientId }
                });

                if (slotTaken) {
                    blockedItems.push({
                        cashCollectionId: cashCollection._id,
                        loanId,
                        clientId: cashCollection.clientId,
                        reason: `Slot ${restoredSlotNo} is now used by another loan (${slotTaken._id}).`
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

            if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
                // Delete new loan
                mutationQL.push(
                    deleteQl(
                        createGraphType('loans', `_id`)(`loans_${mutationQL.length}`),
                        { _id: { _eq: cashCollection.loanId } }
                    )
                );
            }

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
                    { _id: { _eq: loan_history._id } }
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

            // Update client if cashCollection is closed
            if (cashCollection.status == 'closed') {
                groupCache[group._id].slots.push(cashCollection.slotNo);
                mutationQL.push(
                    updateQl(
                        createGraphType('client', `_id`)(`client_${mutationQL.length}`),
                        {
                            set: {
                                // CHANGE: the offset set status = 'offset'; it was never set back.
                                status: 'active',
                                // CHANGE: if oldGroupId/oldLoId were lost, the snapshot still knows
                                // the original group and loan officer. Never write null here.
                                groupId: client.oldGroupId ?? loan_history.data.groupId,
                                loId: client.oldLoId ?? loan_history.data.loId,
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

            return send(res, 200, {
                success: false,
                error: true,
                message: 'Cannot revert: one or more records cannot be safely restored.',
                details: blockedItems
            });
        }

        if (mutationQL.length === 0) {
            return send(res, 200, { success: true, message: 'No valid records to revert' });
        }

        for (const group of Object.values(groupCache)) {
            if (group.slots.length) {
                await updateGroup(mutationQL, group.groupId, group.slots);
            }
        }

        const result = await graph.mutation(...mutationQL);
        return send(res, 200, { success: true, data: result?.data });

    } catch (error) {
        console.error(error);
        logger.error({
            user_id,
            page: 'Rollback Transaction Error',
            error: error.message,
            stack: error.stack
        });

        return send(res, 500, { success: false, error: error.message });
    }
}

async function updateGroup(mutationQl, groupId, slots) {
    const [group] = await findGroups({ _id: { _eq: groupId } });

    if (!group) {
        throw new Error(`Group ${groupId} not found while restoring slots.`);
    }

    // Only count slots that were actually free, so the client count stays correct
    // even if one of them was already re-occupied.
    const currentlyAvailable = group.availableSlots || [];
    const slotsToOccupy = slots.filter(s => currentlyAvailable.includes(s));

    const availableSlots = currentlyAvailable.filter(s => !slots.includes(s));
    const noOfClients = (group.noOfClients || 0) + slotsToOccupy.length;

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