import { CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';

const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = (alias, fields = CASH_COLLECTIONS_FIELDS) => createGraphType('cashCollections', `${fields}`)(alias)
const LOAN_TYPE = (alias, fields = LOAN_FIELDS) => createGraphType('loans', `${fields}`)(alias)
const CLIENT_TYPE = (alias, fields = CLIENT_FIELDS) => createGraphType('client', `${fields}`)(alias);
const GROUP_TYPE = (alias, fields = GROUP_FIELDS) => createGraphType('groups', `${fields}`)(alias);

export default apiHandler({
    post: revert,
});

const revertHandlers = [
    previousCCisNullhandler,
    previousCashCollectionTommorrow,
    normalTransactionNoRemarks,
    normalTransactionDelinquent,
    normalTransactionExcused,
    normalTransactionAdvance,
    normalTransactionExcusedAdvance,
    normalTransactionCompleted,
    normalTransactionPastDue,
    normalTransactionPastDueCollection,
    normalTransactionMaturedPastDue,
    normalTransactionMaturedPastDueCollection,
    normalTransactionOffset,
];

function previousCCisNullhandler({ cl, pcc }, addMutationQl) {
    if(!pcc) {
        return () => {
            addMutationQl(alias => deleteQl(LOAN_TYPE(alias, '_id'), { _id: { _eq: cl._id ?? null } }));
            addMutationQl(alias => updateQl(CLIENT_TYPE(alias, '_id'), {
                set: { status: 'pending' },
                where: { _id: { _eq: cl.clientId ?? null } }
            }));
            return true;
        }
    }
    return false;
}

function previousCashCollectionTommorrow({cl, pcc}, addMutationQl) {
    if(!!pcc.tomorrow) {
        const toUpdated = {
            loanBalance: pcc.amount_release,
            mcbu: 0,
            mcbuCollection: 0,
            advanceDays: 0,
            noOfPayments: 0,
            mcbuWithdrawal: 0,
            history: null
        }

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdated,
            where: {
                _id: { _eq: cl._id ?? null }
            }
        }));

        return true;
    }
    return false;
}

function normalTransactionNoRemarks({ cl, ccc, pcc }, addMutationQl) {
    if (!ccc.remarks?.value) {
        const toUpdated = {
            loanBalance: pcc.loanBalance,
            mcbu: pcc.mcbu,
            mcbuCollection: pcc.mcbuCollection,
            noOfPayments: pcc.noOfPayments,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
            history: pcc.history,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdated,
            where: { _id: { _eq: cl._id } }
        }));

        return true;
    }
    return false;
}

function normalTransactionDelinquent({ cl, ccc, pcc }, addMutationQl) {
    if (ccc.remarks?.value === 'delinquent') {
        const noMispayment = ccc.noMispayment > 0 ?  (ccc.noMispayment - 1) : 0;
        const toUpdateLoan = {
            mispayment: noMispayment,
            history: pcc.history,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        if(noMispayment === 0) {
            addMutationQl((alias) => updateQl(CLIENT_TYPE(alias, '_id'), {
                set: {
                    delinquent: false
                },
                where: { _id: { _eq: ccc.clientId ?? null } }
            }));
        }

        return true;
    }
    return false;
}

function normalTransactionExcused({ cl, ccc, pcc }, addMutationQl) {
    if (!!ccc.remarks?.value?.startsWith('excused')) {
        const noMispayment = ccc.noMispayment > 0 ?  (ccc.noMispayment - 1) : 0;
        const toUpdateLoan = {
            mispayment: noMispayment,
            history: pcc.history,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        return true;
    }
    return false;
}

function normalTransactionAdvance({ cl, ccc, pcc }, addMutationQl) {
    if (ccc.remarks?.value === 'advance payment') {
        const toUpdateLoan = {
            loanBalance: pcc.loanBalance,
            mcbu: pcc.mcbu,
            mcbuCollection: pcc.mcbuCollection,
            noOfPayments: pcc.noOfPayments,
            advanceDays: pcc.advanceDays,
            history: pcc.history,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        return true;
    }
    return false;
}

function normalTransactionExcusedAdvance({ cl, ccc, pcc }, addMutationQl) {
    if (ccc.remarks?.value === 'excused advance payment') {
        const toUpdateLoan = {
            advanceDays: pcc.advanceDays,
            history: pcc.history,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        return true;
    }
    return false;
}

function normalTransactionCompleted({ cl, ccc, pcc, pl }, addMutationQl) {
    if (ccc.remarks?.value?.startsWith('reloaner')) {
        if(cl.status === 'pending' || cl.status === 'active') {
            
            // delete current loan
            addMutationQl((alias) => deleteQl(LOAN_TYPE(alias, '_id'), {
                _id: { _eq: cl._id }
            }));

            if (pcc.status === 'completed') {
                addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
                    set: {
                        status: 'completed',
                        mcbu: pcc.mcbu,
                        mcbuWithdrawal: pcc.mcbuWithdrawal,
                    },
                    where: { _id: { _eq: pl._id ?? null } }
                }));
            }

            if (pcc.status === 'active') {
                addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
                    set: {
                        activeLoan: pcc.activeLoan,
                        amountRelease: pcc.amountRelease,
                        status: 'active',
                        fullPaymentDate: null,
                        mcbu: pcc.mcbu,
                        mcbuCollection: pcc.mcbuCollection,
                        advanceDays: pcc.advanceDays,
                        history: pcc.history,
                        mcbuWithdrawal: pcc.mcbuWithdrawal,
                        noOfPayments: pcc.noOfPayments,
                    },
                    where: { _id: { _eq: pl._id ?? null } }
                }));
            }

        } else {
            let toUpdateLoan = {};

            if (pcc.status === 'completed') {
                toUpdateLoan.mcbuWithdrawal = pcc.mcbuWithdrawal;
            }

            if (pcc.status == 'active') {
                toUpdateLoan = {
                    loanBalance: pcc.loanBalance,
                    mcbu: pcc.mcbu,
                    mcbuCollection: pcc.mcbuCollection,
                    noOfPayments: pcc.noOfPayments,
                    advanceDays: pcc.advanceDays, //- possible multiple payments
                    history: pcc.history,
                    fullPaymentDate: pcc.fullPaymentDate,
                    status: 'active',
                    mcbuWithdrawal: pcc.mcbuWithdrawal,
                }
            }
            
            addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
                set: toUpdateLoan,
                where: { _id: { _eq: cl._id ?? null } }
            }));
        }

        return true;
    }
    return false;
}

function normalTransactionPastDue({ cl, ccc, pcc }, addMutationQl) {
    if (ccc.remarks?.value === 'past due') {
        const noMispayment = ccc.noMispayment > 0 ?  (ccc.noMispayment - 1) : 0;
        const toUpdateLoan = {
            mispayment: noMispayment,
            history: pcc.history,
            pastDue: pcc.pastDue,
            noOfPastDue: pcc.noOfPastDue,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        return true;
    }
    return false;
}


function normalTransactionPastDueCollection({ cl, ccc, pcc }, addMutationQl) {
    if (ccc.remarks?.value === 'past due collection') {
        const toUpdateLoan = {
            loanBalance: pcc.loanBalance,
            mcbu: pcc.mcbu,
            mcbuCollection: pcc.mcbuCollection,
            history: pcc.history,
            pastDue: pcc.pastDue,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        return true;
    }
    return false;
}


function normalTransactionMaturedPastDue({ cl, ccc, pcc }, addMutationQl) {
    if (ccc.remarks?.value === 'matured-past due') {
        const toUpdateLoan = {
            history: pcc.history,
            pastDue: pcc.pastDue,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        return true;
    }
    return false;
}


function normalTransactionMaturedPastDueCollection({ cl, ccc, pcc }, addMutationQl) {
    if (ccc.remarks?.value === 'matured_past_due_collection') {
        const toUpdateLoan = {
            history: pcc.history,
            pastDue: pcc.pastDue,
            mcbu: pcc.mcbu,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        return true;
    }
    return false;
}


function normalTransactionOffset({ cl, ccc, pcc, group }, addMutationQl) {
    if (ccc.remarks?.value?.startsWith('offset')) {
        // update group
        const updateGroup = {
            noOfClients: group.noOfClients + 1,
            availableSlots: group.availableSlots.filter(i => i != ccc.slotNo),
        };

        addMutationQl((alias) => updateQl(GROUP_TYPE(alias, '_id'), {
            set: updateGroup,
            where: {
                _id: { _eq: group._id }
            }
        }));
        
        if (pcc.status == 'active') {
            addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
                set: {
                    activeLoan: pcc.activeLoan,
                    amountRelease: pcc.amountRelease,
                    loanCycle: pcc.loanCycle,
                    loanBalance: pcc.loanBalance,
                    mcbu: pcc.mcbu,
                    mcbuCollection: pcc.mcbuCollection,
                    noOfPayments: pcc.noOfPayments,
                    advanceDays: pcc.advanceDays,
                    history: pcc.history,
                    fullPaymentDate: null,
                    closedDate: null,
                    remarks: null,
                    status: 'active',
                    mcbuWithdrawal: pcc.mcbuWithdrawal,
                },
                where: { _id: { _eq: cl._id ?? null } }
            }));
        }

        if (pcc.status == 'completed') {
            addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
                set: {
                    loanCycle: pcc.loanCycle,
                    mcbu: pcc.mcbu,
                    mcbuReturnAmt: 0,
                    status: 'completed',
                    closedDate: null,
                    remarks: null,
                    history: pcc.history,
                    mcbuWithdrawal: pcc.mcbuWithdrawal,
                },
                where: { _id: { _eq: cl._id ?? null } }
            }));
        }
        

        return true;
    }
    return false;
}

// Batch query functions
async function batchGetEntities(cashCollections) {
    // Create sets of unique IDs to query
    const clientIds = new Set(cashCollections.map(cc => cc.clientId));
    const loanIds = new Set(cashCollections.map(cc => cc.loanId));
    const prevLoanIds = new Set(cashCollections.map(cc => cc.prevLoanId).filter(Boolean));
    const groupIds = new Set(cashCollections.map(cc => cc.groupId));
    const ccIds = new Set(cashCollections.map(cc => cc._id));

    // Prepare all queries in parallel
    const [clients, loans, prevLoans, groups, currentCCs, prevCCs] = await Promise.all([
        // Get all clients in one query
        graph.query(queryQl(CLIENT_TYPE('clients'), { 
            where: { _id: { _in: Array.from(clientIds) } }
        })),
        // Get all loans in one query
        graph.query(queryQl(LOAN_TYPE('loans'), {
            where: { _id: { _in: Array.from(loanIds) } }
        })),
        // Get all previous loans in one query
        prevLoanIds.size > 0 ? graph.query(queryQl(LOAN_TYPE('prevLoans'), {
            where: { _id: { _in: Array.from(prevLoanIds) } }
        })) : { data: { prevLoans: [] } },
        // Get all groups in one query
        graph.query(queryQl(GROUP_TYPE('groups'), {
            where: { _id: { _in: Array.from(groupIds) } }
        })),
        // Get all current cash collections in one query
        graph.query(queryQl(CASH_COLLECTION_TYPE('currentCCs'), {
            where: { _id: { _in: Array.from(ccIds) } }
        })),
        // Get previous cash collections for all clients
        graph.query(queryQl(CASH_COLLECTION_TYPE('prevCCs'), {
            where: { 
                clientId: { _in: Array.from(clientIds) },
                _id: { _nin: Array.from(ccIds) }
            },
            order_by: [{ insertedDateTime: 'desc' }],
            limit: cashCollections.length * 2 // Fetch enough previous records
        }))
    ]);

    // Create lookup maps for quick access
    const entityMaps = {
        clients: new Map(clients.data.clients.map(c => [c._id, c])),
        loans: new Map(loans.data.loans.map(l => [l._id, l])),
        prevLoans: new Map(prevLoans.data.prevLoans.map(l => [l._id, l])),
        groups: new Map(groups.data.groups.map(g => [g._id, g])),
        currentCCs: new Map(currentCCs.data.currentCCs.map(cc => [cc._id, cc])),
        prevCCs: new Map() // Will be populated with previous CCs by client
    };

    // Organize previous cash collections by client
    for (const cc of prevCCs.data.prevCCs) {
        if (!entityMaps.prevCCs.has(cc.clientId)) {
            entityMaps.prevCCs.set(cc.clientId, []);
        }
        entityMaps.prevCCs.get(cc.clientId).push(cc);
    }

    return entityMaps;
}
 
async function revert(req, res) {
    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
    const mutationQL = [];
    const addMutationQl = (handler) => mutationQL.push(handler(`mutate_entity_${mutationQL.length}`));

    const user_id = req?.auth?.sub;
    const cashCollections = req.body;

    try {
        // Batch fetch all required entities
        const entityMaps = await batchGetEntities(cashCollections);

        // Process all cash collections
        const processResults = await Promise.all(cashCollections.map(async cc => {
            try {
                const client = entityMaps.clients.get(cc.clientId);
                const cl = entityMaps.loans.get(cc.loanId);
                const pl = cc.prevLoanId ? entityMaps.prevLoans.get(cc.prevLoanId) : null;
                const group = entityMaps.groups.get(cc.groupId);
                const ccc = entityMaps.currentCCs.get(cc._id);
                const pcc = entityMaps.prevCCs.get(client._id)?.[0];

                // Log debug information
                logger.debug({
                    user_id,
                    page: 'Start Reverting Cash Collection',
                    clientId: ccc?.clientId,
                    _id: ccc?._id,
                    loanId: ccc?.loanId,
                    prevLoanId: ccc?.prevLoanId,
                    client,
                    current_loan: cl,
                    current_cash_collection: ccc,
                    prev_cash_collection: pcc,
                    prev_loan: pl
                });

                // Delete current cash collection
                addMutationQl((alias) => deleteQl(CASH_COLLECTION_TYPE(alias), {
                    clientId: { _eq: client._id },
                    dateAdded: { _eq: currentDate }
                }));

                // Process revert handlers
                for (const revertHandler of revertHandlers) {
                    if (revertHandler({ client, cl, ccc, pcc, group, pl }, addMutationQl)) {
                        return ccc;
                    }
                }

                throw new Error(`No handler for cash collection ${ccc?._id}`);
            } catch (err) {
                logger.debug({
                    user_id,
                    page: 'Error Reverting Cash Collection',
                    clientId: cc.clientId,
                    _id: cc._id,
                    loanId: cc.loanId
                });
                throw err;
            }
        }));

        // Execute all mutations in a single transaction
        await graph.mutation(...mutationQL);

        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ 
                success: true, 
                message: 'Successfully reverted transactions' 
            }));

    } catch (error) {
        return res.status(500)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ 
                error: true, 
                message: error.message || 'Failed to revert transactions' 
            }));
    }
}