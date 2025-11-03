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
    post: processTransactionStatus,
    get: getLOSummary
});

async function processTransactionStatus(req, res) {
    const { loId, branchId, mode, currentDate, currentTime, transactionType, userId, userName } = req.body;

    // Determine if we're operating on a branch or loan officer
    const isBranchLevel = !!branchId;

    console.log('Processing transaction status:', {
        loId,
        branchId,
        mode,
        currentDate,
        isBranchLevel
    });

    if (loId || branchId) {
        const dayName = moment(currentDate).format('dddd').toLowerCase();
        const entityId = isBranchLevel ? branchId : loId;
        const entityField = isBranchLevel ? 'branchId' : 'loId';
        
        // Try to get validation data, but continue even if function doesn't exist
        let cashCollectionCounts;
        let validationAvailable = true;
        
        try {
            cashCollectionCounts = await checkTransactions(
                entityId, 
                currentDate, 
                dayName, 
                transactionType, 
                entityField
            );
            console.log('Validation data retrieved successfully');
        } catch (error) {
            console.warn('Validation function not available, skipping validation checks:', error.message);
            validationAvailable = false;
            // Continue without validation
        }

        // Only run validation checks if function is available
        if (validationAvailable && cashCollectionCounts) {
            const noCollections = cashCollectionCounts.filter(cc => { 
                if (cc.cashCollections.length === 0) {
                    return cc;
                }
            });
            const hasDrafts = cashCollectionCounts.filter(cc => { 
                if ( cc.cashCollections.length > 0 && cc.cashCollections[0].hasDrafts > 0 ) {
                    return cc;
                }
            });

            const hasPendingMcbuWithdrawals = cashCollectionCounts.filter(cc => cc.mcbuw_count > 0);
            const hasPendingFundTransfers = cashCollectionCounts.filter(cc => cc.ft_count > 0);
            const hasPendingDenominations = cashCollectionCounts.filter(cc => cc.denom_count > 0);
            const noDenominationTransactions = cashCollectionCounts.filter(cc => cc.denom === 0);
            const hasPendingLoans = cashCollectionCounts.filter(cc => cc.pending_count > 0);

            if (mode === 'close') {
                if (noCollections.length > 0) {
                    const entityType = isBranchLevel ? "branch" : "selected Loan Officer";
                    response = { error: true, message: `Some groups have no current transactions for the ${entityType}.` };
                } else if (hasDrafts.length > 0) {
                    const entityType = isBranchLevel ? "branch" : "selected Loan Officer";
                    response = { error: true, message: `Some groups have draft transactions for the ${entityType}.` };
                } else if (hasPendingMcbuWithdrawals.length > 0) {
                    const entityType = isBranchLevel ? "branch" : "selected Loan Officer";
                    response = { error: true, message: `Some groups have pending MCBU withdrawals for the ${entityType}. Please reject or delete them.` };
                } else if (hasPendingFundTransfers.length > 0) {
                    response = { error: true, message: "Branch has a pending Fund Transfer. Please check and approve or contact Finance Admin." };
                } else if (noDenominationTransactions.length > 0) {
                    const entityType = isBranchLevel ? "Branch" : "LO";
                    response = { error: true, message: `${entityType} has no Denomination entries. Please check and add them.` };
                } else if (hasPendingDenominations.length > 0) {
                    const entityType = isBranchLevel ? "Branch" : "LO";
                    response = { error: true, message: `${entityType} has pending Denomination entries. Please check and approve or contact Cashier.` };
                } else if (hasPendingLoans.length > 0) {
                    const entityType = isBranchLevel ? "Branch" : "LO";
                    response = { error: true, message: `${entityType} has pending Loan entries. Please check and approve or contact Branch Manager.` };
                }
            }
        }

        // If validation passed or was skipped, proceed with the operation
        if (!response.error) {
            let result;

            if (isBranchLevel) {
                // For branch-level operations, use the branchApprovals table
                result = await handleBranchApproval(branchId, currentDate, mode, userId, userName);
                response = result;
            } else {
                // For LO-level operations, update groupStatus and closingTime (existing behavior)
                const whereClause = { loId: { _eq: loId }, dateAdded: { _eq: currentDate } };

                console.log('Updating cashCollections with whereClause:', whereClause);
                console.log('Mode:', mode, 'validationAvailable:', validationAvailable);

                try {
                    // Check if we have closing time info from validation
                    const hasClosingTime = validationAvailable && cashCollectionCounts 
                        ? cashCollectionCounts.filter(cc => 
                            cc.cashCollections.length > 0 && 
                            cc.cashCollections[0].hasClosingTime && 
                            cc.cashCollections[0].hasClosingTime.length > 0
                          )
                        : [];

                    if (mode === 'close' && hasClosingTime.length === 0) {
                        result = await graph.mutation(
                            updateQl(CASH_COLLECTION_TYPE, {
                                set: {
                                    groupStatus: 'closed',
                                    closingTime: currentTime
                                },
                                where: whereClause
                            })
                        );
                    } else {
                        result = await graph.mutation(
                            updateQl(CASH_COLLECTION_TYPE, {
                                set: {
                                    groupStatus: mode === 'close' ? 'closed' : 'pending',
                                    closingTime: mode === 'close' ? currentTime : null,
                                },
                                where: whereClause
                            })
                        );
                    }

                    console.log('Mutation result:', JSON.stringify(result, null, 2));

                    // Check if result and result.data exist
                    if (!result) {
                        console.error('Result is null or undefined');
                        response = { error: true, message: "Mutation returned no result." };
                    } else if (!result.data) {
                        console.error('Result.data is undefined:', result);
                        response = { error: true, message: "Mutation returned unexpected structure." };
                    } else if (!result.data.collections) {
                        console.error('Result.data.collections is undefined:', result.data);
                        response = { error: true, message: "Mutation did not return collections data." };
                    } else if (result.data.collections.affected_rows === 0) {
                        console.warn('No rows affected by mutation');
                        response = { error: true, message: "No transactions found for this Loan Officer." };
                    } else {
                        console.log('Mutation successful, affected rows:', result.data.collections.affected_rows);
                        response = { success: true };
                    }
                } catch (mutationError) {
                    console.error('Error executing mutation:', mutationError);
                    response = { 
                        error: true, 
                        message: "Error updating loan officer status: " + mutationError.message 
                    };
                }
            }
        }

    } else {
        response = { error: true, message: "Loan Officer Id or Branch Id not found." };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
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
                                userName: userName
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
                                dateFor: dateFor
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
                                userName: userName
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
                                dateFor: dateFor
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

const checkTransactions = async (entityId, currentDate, dayName, transactionType, entityField) => {
    console.log('checkTransactions called with:', {
        entityId,
        currentDate,
        dayName,
        transactionType,
        entityField
    });

    try {
        const isBranchLevel = entityField === 'branchId';
        
        let query, variables;
        
        if (isBranchLevel) {
            // Branch-level query
            query = gql`
                query branchTransactions ($args: get_branch_transaction_summary_arguments!) {
                    collections: get_branch_transaction_summary(args: $args) {
                        _id,
                        data
                    }
                }
            `;
            variables = {
                args: {
                    branchId: entityId,
                    dateAdded: currentDate,
                    dayName: dayName,
                    transactionType: transactionType,
                }
            };
        } else {
            // LO-level query (existing)
            query = gql`
                query groups ($where: loan_group_model_bool_exp_bool_exp, $args: get_lo_transaction_summary_arguments!) {
                    collections: get_lo_transaction_summary(args: $args, where: $where) {
                        _id,
                        data
                    }
                }
            `;
            variables = {
                args: {
                    loId: entityId,
                    dateAdded: currentDate,
                    dayName: dayName,
                    transactionType: transactionType,
                }
            };
        }

        console.log(`Using ${isBranchLevel ? 'branch' : 'LO'} level query with entityId:`, entityId);

        const collections = await graph.apollo.query({
            query,
            variables
        })
        .then(res => {
            console.log('Transaction summary response:', JSON.stringify(res.data, null, 2));
            if (!res.data || !res.data.collections) {
                throw new Error('Function returned no data - function may not exist');
            }
            return res.data.collections.map(c => c.data);
        });

        console.log('Processed collections:', collections);
        return collections;
    } catch (error) {
        console.error('Error in checkTransactions GraphQL query:', error);
        throw error;
    }
};