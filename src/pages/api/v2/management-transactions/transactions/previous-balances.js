import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();

/**
 * Convert type_code to snake_case slug for database queries
 */
function getTransactionTypeSlug(typeCode, typeName) {
    if (/^[a-z_]+$/.test(typeCode)) {
        return typeCode;
    }
    
    return typeName
        .toLowerCase()
        .replace(/[^\w\s-\/]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[-\/]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

export default apiHandler({
    get: getPreviousBalances,
});

async function getPreviousBalances(req, res) {
    const { transactionType, branchId } = req.query;

    if (!transactionType || !branchId) {
        return res.status(400).json({
            error: true,
            message: 'Transaction type and branch ID are required'
        });
    }

    try {
        // Get account type to retrieve type_name for slug generation
        const accountTypesType = createGraphType(
            "management_account_types",
            `
                _id
                type_code
                type_name
            `
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

        // Generate slug for database query
        const transactionTypeSlug = getTransactionTypeSlug(
            accountType.type_code,
            accountType.type_name
        );

        console.log('Getting previous balances for:', {
            type_code: transactionType,
            type_name: accountType.type_name,
            slug: transactionTypeSlug,
            branch: branchId
        });

        // Query to get the LAST transaction for each account in this branch
        // REGARDLESS of date - just get the most recent one
        const managementTransactionsType = createGraphType(
            "management_transactions",
            `
                _id
                account_id
                total_balance
                date_added
            `
        );

        const graphRes = await graph.query(
            queryQl(managementTransactionsType(), {
                where: { 
                    transaction_type: { _eq: transactionTypeSlug },
                    branch_id: { _eq: branchId },
                    account: { is_active: { _eq: true } }
                },
                order_by: [
                    { account_id: 'asc' },
                    { date_added: 'desc' }
                ]
            })
        );

        const transactions = graphRes?.data?.management_transactions ?? [];

        console.log('Found transactions:', transactions.length);

        // Get the most recent transaction for each account
        const previousBalances = {};
        const seenAccounts = new Set();

        transactions.forEach(transaction => {
            if (!seenAccounts.has(transaction.account_id)) {
                previousBalances[transaction.account_id] = transaction.total_balance || 0;
                seenAccounts.add(transaction.account_id);
            }
        });

        console.log('Previous balances:', previousBalances);

        return res.status(200).json({
            success: true,
            previousBalances: previousBalances
        });

    } catch (error) {
        console.error('Error fetching previous balances:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch previous balances: ' + error.message
        });
    }
}