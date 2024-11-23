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

let statusCode = 200;
let response = {};

const getClientById = (_id) => graph.query(queryQl(CLIENT_TYPE('clients'), { where: { _id: { _eq: _id } } })).then(res => res.data.clients);
const getLoanById = (_id) => graph.query(queryQl(LOAN_TYPE('loans'), {where: { _id: { _eq: _id } }})).then(res =>  res.data.loans);
const getCashCollections = (where, limit, order_by) => graph.query(queryQl(CASH_COLLECTION_TYPE('cashCollections'), { where, order_by, limit })).then(res => res.data.cashCollections);
const getGroup = (_id) => graph.query(queryQl(GROUP_TYPE('groups'), {where: { _id: { _eq: _id } }})).then(res => res.data.groups);

const revertHandlers = [
    previousCCisNullhandler,
    previousCashCollectionTommorrow,
    normalTransactionNoRemarks,
    normalTransactionDelinquent,
    normalTransactionExcused,
    normalTransactionAdvance,
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
        const noOfMispayment = ccc.noOfMispayment > 0 ?  (ccc.noOfMispayment - 1) : 0;
        const toUpdateLoan = {
            noOfMispayment,
            history: pcc.history,
            mcbuWithdrawal: pcc.mcbuWithdrawal,
        };

        addMutationQl((alias) => updateQl(LOAN_TYPE(alias, '_id'), {
            set: toUpdateLoan,
            where: { _id: { _eq: cl._id ?? null } }
        }));

        if(noOfMispayment === 0) {
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
        const noOfMispayment = ccc.noOfMispayment > 0 ?  (ccc.noOfMispayment - 1) : 0;
        const toUpdateLoan = {
            noOfMispayment,
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

function normalTransactionAdvance({ cl, ccc, pcc }, addMutationQl) {
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
        const toUpdateLoan = {
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
            availableSlots: group.availableSlots.filter(i => i != cc.slotNo),
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
 
async function revert(req, res) {
    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');
    const mutationQL = [];
    const addMutationQl = (handler) => mutationQL.push(handler(`mutate_entity_` + mutationQL.length));

    const user_id = req?.auth?.sub;
    const cashCollections = req.body;

    await Promise.all(cashCollections.forEach(async cc => {
        // get cash collection
        try {
            
            const [client] = await getClientById(cc.clientId);
            const [cl] = await getLoanById(cc.loanId);
            const [pl] =  await getLoanById(ccc.prevLoanId);
            const [group] = await getGroup(cc.groupId);

            const ccc = await getCashCollections({ _id: cc._id });
            const pcc = await getCashCollections({ clientId: { _eq: client._id } }, 2, [{ insertedDateTime: 'desc' }]).then(collections => collections?.[1]);
            
            logger.debug({user_id, page: `Start Reverting Cash Collection `, clientId:  ccc.clientId, _id: ccc._id, loanId: ccc.loanId, prevLoanId: ccc.prevLoanId, client, current_loan: cl, current_cash_collection: ccc, prev_cash_collection: pcc, prev_loan: pl});

            // Always delete current cash collection of client_id and dateAdded
            addMutationQl((alias) => deleteQl(CASH_COLLECTION_TYPE(alias), { clientId: { _eq: client._id }, dateAdded: { _eq: currentDate } }));
           
            // revert handelrs in sequence
            for(const reverHandler of revertHandlers) {
                if (reverHandler({client, cl, ccc, pcc, group, pl}, addMutationQl)) {
                    return ccc;
                }
            }

            throw { message: 'no handler for cash collection ' + cc._id  };

        } catch (err) {
            logger.debug({user_id, page: `Error Reverting Cash Collection `, clientId:  ccc.clientId, _id: ccc._id, loanId: ccc.loanId});
            throw err;
        }
    }));

    await graph.mutation(
        ... mutationQL
    );


    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
