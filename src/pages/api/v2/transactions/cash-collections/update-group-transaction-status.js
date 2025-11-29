import { CASH_COLLECTIONS_FIELDS, BRANCH_APPROVAL_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import moment from 'moment';

let response = {};
let statusCode = 200;

const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `_id`)('collections');
const BRANCH_APPROVAL_TYPE = createGraphType('branchApprovals', `_id`)('approvals');
const graph = new GraphProvider();

export default apiHandler({
    post: processGroupTransactionStatus,
    get: getLOSummary
});

async function processGroupTransactionStatus(req, res) {
    const { loId, branchId, mode, currentDate, currentTime, transactionType, userId, userName } = req.body;

    // Determine if this is a branch-level or LO-level operation
    const isBranchLevel = !!branchId && !loId;

    if (isBranchLevel) {
        // BRANCH-LEVEL APPROVAL
        await processBranchApproval(branchId, currentDate, mode, userId, userName);
    } else if (loId) {
        // LO-LEVEL APPROVAL (existing logic)
        await processLOApproval(loId, currentDate, currentTime, mode, transactionType);
    } else {
        response = { error: true, message: "Either Branch ID or Loan Officer ID is required." };
        statusCode = 400;
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function processBranchApproval(branchId, dateFor, mode, userId, userName) {
    try {
        // Before closing, verify all LO transactions for this branch are closed
        if (mode === 'close') {
            const unclosedTransactions = await checkBranchTransactionStatus(branchId, dateFor);
            
            if (unclosedTransactions.length > 0) {
                response = { 
                    error: true, 
                    message: "Cannot approve branch. Some Loan Officers still have open or pending transactions. All LO transactions must be closed first." 
                };
                return;
            }
        }

        // Handle branch approval
        const approvalResult = await handleBranchApproval(branchId, dateFor, mode, userId, userName);
        
        if (approvalResult.success) {
            const actionText = mode === 'close' ? 'locked and approved' : 'unlocked';
            response = { 
                success: true, 
                message: `Branch has been ${actionText} successfully.` 
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

async function processLOApproval(loId, currentDate, currentTime, mode, transactionType) {
    const dayName = moment(currentDate).format('dddd').toLowerCase();
    const cashCollectionCounts = await checkLoTransactions(loId, currentDate, dayName, transactionType);

    if (cashCollectionCounts) {
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
            const tda = currentCc ? currentCc.tda : 0;
            const goodExcused = currentCc ? currentCc.goodExcused : 0;
            const pastDue = currentCc ? currentCc.pastDue : 0;
            const maturedPd = currentCc ? currentCc.maturedPd : 0;
            const mispayments = currentCc ? currentCc.mispayments + tda + goodExcused + maturedPd + pastDue : 0;
            if (cc.denom === 0 && cc.cashCollections.length > 0 
                && currentCc.count > 0
                && mispayments > 0
                && currentCc.count !== mispayments) {
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

        // console.log('finalNoDenominationTransactions:', finalNoDenominationTransactions[0]?.cashCollections);
        // console.log('finalValidNoDenominationTransactions:', finalValidNoDenominationTransactions[0]?.cashCollections);
        
        const hasPendingLoans = cashCollectionCounts.filter(cc => cc.pending_count > 0);

        if (mode === 'close') {
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
                response = { error: true, message: "Branch has a pending Fund Transfer. Please check and approve or contact Finance Admin." };
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
        }

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
            response = { success: true };
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
                                dateModified: new Date().toISOString()
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
        } else {
            // mode === 'open'
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