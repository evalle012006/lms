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

export default apiHandler({
    post: save,
});

async function save(req, res) {
    const { transactionType, branchId, dateAdded, userId, transactions } = req.body;

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
        const formattedDate = dateAdded ? moment(dateAdded).format('YYYY-MM-DD') : moment(getCurrentDate()).format('YYYY-MM-DD');
        const currentDateTime = moment().toISOString();

        // ==========================================
        // STEP 1: QUERY EXISTING TRANSACTIONS
        // ==========================================
        console.log('Querying existing transactions...');
        
        const existingCheck = await graph.query(
            queryQl(MANAGEMENT_TRANSACTIONS_TYPE(), {
                where: {
                    transaction_type: { _eq: transactionType },
                    branch_id: { _eq: branchId },
                    date_added: { _eq: formattedDate }
                }
            })
        );

        const existingTransactions = existingCheck?.data?.management_transactions || [];
        console.log(`Found ${existingTransactions.length} existing transactions`);

        // Create a map of existing transactions by account_id for quick lookup
        const existingMap = new Map();
        existingTransactions.forEach(transaction => {
            existingMap.set(transaction.account_id, transaction);
        });

        // ==========================================
        // STEP 2: VALIDATE AND PREPARE DATA
        // ==========================================
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
                // Validate each transaction
                if (!transaction.accountId) {
                    results.failed.push({
                        accountId: transaction.accountId,
                        error: 'Each transaction must have accountId'
                    });
                    continue;
                }

                // Parse amounts
                const previousBalance = parseFloat(transaction.previousBalance) || 0;
                const debit = parseFloat(transaction.debit) || 0;
                const credit = parseFloat(transaction.credit) || 0;

                // Calculate total balance
                const totalBalance = previousBalance + debit - credit;

                // Validate that at least one field has a value
                if (previousBalance === 0 && debit === 0 && credit === 0) {
                    results.failed.push({
                        accountId: transaction.accountId,
                        error: 'At least one field (Previous Balance, Debit, or Credit) must have a value'
                    });
                    continue;
                }

                const existingTransaction = existingMap.get(transaction.accountId);

                if (existingTransaction) {
                    // UPDATE existing transaction
                    console.log(`Preparing UPDATE for account ${transaction.accountId}`);
                    
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
                    // INSERT new transaction
                    console.log(`Preparing INSERT for account ${transaction.accountId}`);
                    
                    const transactionData = {
                        _id: generateUUID(),
                        transaction_type: transactionType,
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

        // ==========================================
        // STEP 3: EXECUTE BATCH MUTATIONS
        // ==========================================
        if (mutationList.length > 0) {
            console.log(`\n=== EXECUTING BATCH MUTATIONS ===`);
            console.log(`Mutations to execute: ${mutationList.length}`);
            console.log(`- Updates: ${results.updated.length}`);
            console.log(`- Inserts: ${results.inserted.length}`);
            
            const mutationResult = await graph.mutation(...mutationList);

            // Check for GraphQL errors
            if (mutationResult.errors) {
                console.error('GraphQL errors:', mutationResult.errors);
                return res.status(400).json({
                    error: true,
                    message: mutationResult.errors[0]?.message || 'Failed to save transactions'
                });
            }

            console.log('✓ Batch mutations completed successfully');
        }

        // ==========================================
        // STEP 4: DELETE TRANSACTIONS FOR REMOVED ACCOUNTS
        // ==========================================
        const submittedAccountIds = transactions.map(t => t.accountId);
        const accountsToDelete = existingTransactions.filter(
            existing => !submittedAccountIds.includes(existing.account_id)
        );

        if (accountsToDelete.length > 0) {
            console.log(`Deleting ${accountsToDelete.length} removed transactions`);
            
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

        console.log('\n=== BATCH SAVE COMPLETE ===');
        console.log('Summary:', {
            updated: results.updated.length,
            inserted: results.inserted.length,
            deleted: accountsToDelete.length,
            failed: results.failed.length
        });

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
        console.error('Error stack:', error.stack);
        
        return res.status(500).json({
            error: true,
            message: 'Failed to save transactions: ' + error.message
        });
    }
}