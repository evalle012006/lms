import { CASH_COLLECTIONS_FIELDS, LOAN_FIELDS, QR_CASH_COLLECTION_ENTRY_FIELDS } from '@/lib/graph.fields';
import { findClients, findGroups, findLoans, findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `${CASH_COLLECTIONS_FIELDS}`)
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`)
const QR_ENTRY_TYPE = createGraphType('qr_cash_collection_entries', `${QR_CASH_COLLECTION_ENTRY_FIELDS}`)

export default apiHandler({
    post: revert,
});

async function revert(req, res) {
    const user_id = req?.auth?.sub;
    const cashCollections = req.body;
    let statusCode = 200;
    let response = {};
    const mutationQL = [];

    try {
        // ── BM limit: resolve requesting user's role ──────────────────────
        const requestingUser = await findUserById(user_id);
        const isBranchManager = requestingUser?.role?.rep === 3;

        // ── Pre-flight BM limit check (before touching any mutations) ─────
        if (isBranchManager) {
            const allLoanIds = cashCollections.map(cc =>
                (cc.status === 'pending' || cc.status === 'tomorrow') && cc.loanCycle > 1
                    ? cc.prevLoanId
                    : cc.loanId
            ).filter(Boolean);

            const loans = await findLoans({ _id: { _in: [...new Set(allLoanIds)] } });
            const blocked = loans.some(l => (l.bmRevertCount || 0) >= 1);

            if (blocked) {
                return res.status(200)
                  .setHeader('Content-Type', 'application/json')
                  .end(JSON.stringify({
                      success: false,
                      error: true,
                      message: 'Branch manager has already used their one-time revert for this slot. Only a higher-level manager can revert this transaction.'
                  }));
            }
        }
        // ─────────────────────────────────────────────────────────────────

        const groupCache = {};

        for (const cc of cashCollections) {
            let cashCollection = {...cc};
            let loanId = cashCollection.loanId;
            if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
                loanId = cashCollection.prevLoanId;
            }

            if (!loanId) {
                continue;
            }

            logger.debug({
                user_id,
                page: `Reverting Transaction Loan: ${cashCollection.clientId}`,
                data: cashCollection
            });

            // Get loan history
            const loanHistoryResult = await graph.query(
                queryQl(createGraphType('loans_history', `_id data`)('loan_history'), {
                    where: {
                        loan_id: { _eq: loanId }
                    },
                    limit: 1,
                    order_by: [{
                        created_dt: 'desc'
                    }]
                })
            );

            console.log('done loan fetch');

            const loan_history = loanHistoryResult.data?.loan_history?.[0];
            const currentLoan = await findLoans({ _id: { _eq: loanId } }).then(r => r[0]);

            const [client] = await findClients({ _id: { _eq: loan_history.data.clientId } });
            const [group] = await findGroups({ _id: { _eq: loan_history.data['groupId'] } });

            if (!groupCache[group._id]) {
                groupCache[group._id] = {
                    groupId: group._id,
                    slots: []
                };
            }

            // new loan should be ignored in rollback
            const ignoreRollback = (currentLoan.status == 'pending' && currentLoan.loanCycle == 1);
            if (ignoreRollback) {
                continue;
            }

            if (loan_history) {
                // Delete cash collection
                mutationQL.push(
                    deleteQl(
                        CASH_COLLECTION_TYPE(`cash_collection_${mutationQL.length}`),
                        { _id: { _eq: cashCollection._id } }
                    )
                );

                // Un-merge any QR entry that pointed at this now-deleted row. Blind
                // update — if no QR entry matches (the common case), this mutation
                // just affects zero rows, no need to query first.
                mutationQL.push(
                    updateQl(
                        QR_ENTRY_TYPE(`qr_unmerge_${mutationQL.length}`),
                        {
                            set: { status: 'pending', mergedIntoCashCollectionId: null },
                            where: { mergedIntoCashCollectionId: { _eq: cashCollection._id } }
                        }
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

                let prevLoanData = {
                    ...loan_history.data,
                    reverted: true,
                    revertedDateTime: new Date(),
                    // ── Stamp BM revert count ────────────────────────────
                    bmRevertCount: isBranchManager
                        ? (currentLoan.bmRevertCount || 0) + 1
                        : (currentLoan.bmRevertCount || 0),
                    // ────────────────────────────────────────────────────
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
                                    groupId: client.oldGroupId,
                                    loId: client.oldLoId,
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
        }

        // Execute mutations if there are any
        if (mutationQL.length > 0) {
            const groups = Object.values(groupCache);
            for (const group of groups) {
                if (group.slots.length) {
                    await updateGroup(mutationQL, group.groupId, group.slots);
                }
            }

            const result = await graph.mutation(...mutationQL);
            response = { success: true, data: result?.data };
        } else {
            response = { success: true, message: "No valid records to revert" };
        }

    } catch (error) {
        console.error(error);
        logger.error({
            user_id,
            page: 'Rollback Transaction Error',
            error: error.message,
            stack: error.stack
        });

        statusCode = 500;
        response = {
            success: false,
            error: error.message
        };
    } finally {
        res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));
    }
}

async function updateGroup(mutationQl, groupId, slots) {
    const [group] = await findGroups({ _id: { _eq: groupId } });
    group.availableSlots = group.availableSlots.filter(s => !slots.includes(s));
    group.noOfClients = group.noOfClients + slots.length;
    if (group.capacity == group.noOfClients) {
        group.status = 'full';
    } else {
        group.status = 'available';
    }

    delete group._id;

    mutationQl.push(
        updateQl(
            createGraphType('groups', `_id`)(`groupst_${mutationQl.length}`),
            {
                set: { ...group },
                where: { _id: { _eq: groupId } }
            }
        )
    );
}