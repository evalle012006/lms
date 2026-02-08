import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

// Fields for insert/update operations
const TRANSACTION_INSERT_FIELDS = `
    _id
    transaction_type
    branch_id
    account_id
    previous_balance
    debit
    credit
    total_balance
    date_added
    inserted_date
    inserted_by
    modified_date
    modified_by
    remarks
`;

const MANAGEMENT_TRANSACTIONS_TYPE = createGraphType('management_transactions', TRANSACTION_INSERT_FIELDS);

/**
 * Convert type_code to snake_case slug for better readability
 */
function getTransactionTypeSlug(typeCode, typeName) {
    // If type_code is already in snake_case format, use it
    if (/^[a-z_]+$/.test(typeCode)) {
        return typeCode;
    }
    
    // Convert type_name to snake_case slug
    return typeName
        .toLowerCase()
        .replace(/[^\w\s-\/]/g, '')   // Remove special chars except spaces/hyphens/slashes
        .replace(/\s+/g, '_')          // Spaces → underscores
        .replace(/[-\/]+/g, '_')       // Hyphens and slashes → underscores
        .replace(/_+/g, '_')           // Multiple underscores → single
        .replace(/^_|_$/g, '');        // Trim underscores from ends
}

export default apiHandler({
    post: save,
});

async function save(req, res) {
    const { transactionType, branchId, dateAdded, userId, transactions } = req.body;

    console.log('=== SAVE MANAGEMENT TRANSACTIONS ===');
    console.log('Transaction Type:', transactionType);

    // Validation
    if (!transactionType || !branchId || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Transaction type, branch, and user ID are required'
        });
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({
            error: true,
            message: 'Transactions array is required and must not be empty'
        });
    }

    try {
        // Get account type to retrieve type_name for slug generation
        const accountTypesType = createGraphType(
            "management_account_types",
            `_id type_code type_name`
        );

        const accountTypeRes = await graph.query(
            queryQl(accountTypesType(), {
                where: { 
                    type_code: { _eq: transactionType },
                    is_active: { _eq: true }
                }
            })
        );

        const accountType = accountTypeRes?.data?.management_account_types?.[0];
        
        if (!accountType) {
            return res.status(400).json({
                error: true,
                message: `Account type "${transactionType}" not found`
            });
        }

        // Generate slug for database (more readable than type_code)
        const transactionTypeSlug = getTransactionTypeSlug(
            accountType.type_code, 
            accountType.type_name
        );

        console.log('Using transaction_type:', transactionTypeSlug);

        const formattedDate = dateAdded ? moment(dateAdded).format('YYYY-MM-DD') : moment(getCurrentDate()).format('YYYY-MM-DD');
        const currentDateTime = moment().toISOString();

        // Query existing transactions
        const existingCheck = await graph.query(
            queryQl(MANAGEMENT_TRANSACTIONS_TYPE(), {
                where: {
                    transaction_type: { _eq: transactionTypeSlug },
                    branch_id: { _eq: branchId },
                    date_added: { _eq: formattedDate }
                }
            })
        );

        const existingTransactions = existingCheck?.data?.management_transactions || [];
        const existingMap = new Map();
        existingTransactions.forEach(transaction => {
            existingMap.set(transaction.account_id, transaction);
        });

        // Prepare mutations
        const results = {
            updated: [],
            inserted: [],
            failed: []
        };

        const mutationList = [];
        const addToMutationList = addToList => mutationList.push(addToList(`mutation_${mutationList.length}`));

        for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];

            try {
                if (!transaction.accountId) {
                    results.failed.push({
                        accountId: transaction.accountId,
                        error: 'Each transaction must have accountId'
                    });
                    continue;
                }

                const previousBalance = parseFloat(transaction.previousBalance) || 0;
                const debit = parseFloat(transaction.debit) || 0;
                const credit = parseFloat(transaction.credit) || 0;
                const totalBalance = previousBalance + debit - credit;

                if (previousBalance === 0 && debit === 0 && credit === 0) {
                    results.failed.push({
                        accountId: transaction.accountId,
                        error: 'At least one field must have a value'
                    });
                    continue;
                }

                const existingTransaction = existingMap.get(transaction.accountId);

                if (existingTransaction) {
                    // UPDATE
                    addToMutationList(alias => updateQl(MANAGEMENT_TRANSACTIONS_TYPE(alias), {
                        where: { _id: { _eq: existingTransaction._id } },
                        set: {
                            previous_balance: previousBalance,
                            debit: debit,
                            credit: credit,
                            total_balance: totalBalance,
                            modified_date: currentDateTime,
                            modified_by: userId,
                            remarks: transaction.remarks || null
                        }
                    }));

                    results.updated.push({
                        accountId: transaction.accountId,
                        transactionId: existingTransaction._id
                    });
                } else {
                    // INSERT
                    const transactionData = {
                        _id: generateUUID(),
                        transaction_type: transactionTypeSlug,
                        branch_id: branchId,
                        account_id: transaction.accountId,
                        previous_balance: previousBalance,
                        debit: debit,
                        credit: credit,
                        total_balance: totalBalance,
                        date_added: formattedDate,
                        inserted_date: currentDateTime,
                        inserted_by: userId,
                        modified_date: currentDateTime,
                        modified_by: userId,
                        remarks: transaction.remarks || null
                    };

                    addToMutationList(alias => insertQl(MANAGEMENT_TRANSACTIONS_TYPE(alias), {
                        objects: [transactionData]
                    }));

                    results.inserted.push({
                        accountId: transaction.accountId
                    });
                }

            } catch (error) {
                console.error(`Error processing transaction ${i + 1}:`, error);
                results.failed.push({
                    accountId: transaction.accountId,
                    error: error.message
                });
            }
        }

        // Execute batch mutations
        if (mutationList.length > 0) {
            const mutationResult = await graph.mutation(...mutationList);

            if (mutationResult.errors) {
                console.error('GraphQL errors:', mutationResult.errors);
                return res.status(400).json({
                    error: true,
                    message: mutationResult.errors[0]?.message || 'Failed to save transactions'
                });
            }
        }

        // Delete removed accounts
        const submittedAccountIds = transactions.map(t => t.accountId);
        const accountsToDelete = existingTransactions.filter(
            existing => !submittedAccountIds.includes(existing.account_id)
        );

        if (accountsToDelete.length > 0) {
            const deleteIds = accountsToDelete.map(t => t._id);
            await graph.mutation(
                `mutation DeleteRemovedTransactions($ids: [uuid!]!) {
                    delete_management_transactions(where: { _id: { _in: $ids } }) {
                        affected_rows
                    }
                }`,
                { ids: deleteIds }
            );
        }

        console.log('✓ Transactions saved successfully');

        return res.status(200).json({
            success: true,
            message: 'Transactions saved successfully',
            summary: {
                total: transactions.length,
                updated: results.updated.length,
                inserted: results.inserted.length,
                deleted: accountsToDelete.length,
                failed: results.failed.length
            },
            results: results
        });

    } catch (error) {
        console.error('Error saving transactions:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to save transactions: ' + error.message
        });
    }
}