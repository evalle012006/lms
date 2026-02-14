import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MANAGEMENT_ACCOUNT_TYPE_FIELD, MANAGEMENT_ACCOUNT_FIELD, MANAGEMENT_TRANSACTION_FIELD } from "@/lib/graph.fields";

const graph = new GraphProvider();

export default apiHandler({
    get: getDisplayGroupData,
});

async function getDisplayGroupData(req, res) {
    const { branchId, date, displayGroup } = req.query;

    if (!branchId || !date || !displayGroup) {
        return res.status(400).json({
            error: true,
            message: 'Branch ID, date, and display group are required'
        });
    }

    // Validate display_group value
    const validDisplayGroups = ['assets', 'liabilities', 'management_expenses'];
    if (!validDisplayGroups.includes(displayGroup)) {
        return res.status(400).json({
            error: true,
            message: 'Invalid display group value. Valid values are: assets, liabilities, management_expenses'
        });
    }

    try {
        // Fetch all account types with the specified display_group
        const managementAccountTypesType = createGraphType(
            "management_account_types",
            MANAGEMENT_ACCOUNT_TYPE_FIELD
        );

        const accountTypesRes = await graph.query(
            queryQl(managementAccountTypesType(), {
                where: { 
                    is_active: { _eq: true },
                    display_group: { _eq: displayGroup }
                },
                order_by: [{ display_order: 'asc' }, { type_name: 'asc' }]
            })
        );

        const accountTypes = accountTypesRes?.data?.management_account_types ?? [];

        if (accountTypes.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    accountTypes: [],
                    totals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 }
                },
                grandTotals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 }
            });
        }

        // Fetch all active accounts for these account types
        const accountTypeIds = accountTypes.map(at => at._id);
        
        const managementAccountsType = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

        const accountsRes = await graph.query(
            queryQl(managementAccountsType(), {
                where: { 
                    is_active: { _eq: true },
                    account_type_id: { _in: accountTypeIds }
                },
                order_by: [{ display_order: 'asc' }, { account_name: 'asc' }]
            })
        );

        const accounts = accountsRes?.data?.management_accounts ?? [];

        // Fetch all transactions for the branch and date
        const managementTransactionsType = createGraphType(
            "management_transactions",
            MANAGEMENT_TRANSACTION_FIELD
        );

        const transactionsRes = await graph.query(
            queryQl(managementTransactionsType(), {
                where: {
                    branch_id: { _eq: branchId },
                    date_added: { _eq: date }
                }
            })
        );

        const transactions = transactionsRes?.data?.management_transactions ?? [];

        // Create a map of account_id to transaction data
        const transactionMap = {};
        transactions.forEach(t => {
            const prevBalance = parseFloat(t.previous_balance) || 0;
            const debit = parseFloat(t.debit) || 0;
            const credit = parseFloat(t.credit) || 0;
            
            transactionMap[t.account_id] = {
                previous_balance: prevBalance,
                debit: debit,
                credit: credit,
                total_balance: prevBalance + debit - credit
            };
        });

        // Build the response structure
        const resultAccountTypes = [];
        const grandTotals = {
            previousBalance: 0,
            debit: 0,
            credit: 0,
            totalBalance: 0
        };

        // Process each account type
        accountTypes.forEach(accountType => {
            const typeAccounts = accounts.filter(a => a.account_type_id === accountType._id);
            
            // Filter accounts that have transactions with non-zero values
            const accountsWithData = typeAccounts
                .map(account => {
                    const txData = transactionMap[account._id];
                    if (!txData) return null;
                    
                    // Only include if any value is > 0 or total is not 0
                    if (txData.previous_balance > 0 || txData.debit > 0 || txData.credit > 0 || txData.total_balance !== 0) {
                        return {
                            _id: account._id,
                            account_name: account.account_name,
                            description: account.description,
                            ...txData
                        };
                    }
                    return null;
                })
                .filter(Boolean);

            // Calculate totals for this account type
            const typeTotals = accountsWithData.reduce((acc, account) => {
                acc.previousBalance += account.previous_balance;
                acc.debit += account.debit;
                acc.credit += account.credit;
                acc.totalBalance += account.total_balance;
                return acc;
            }, { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 });

            // Add to grand totals
            grandTotals.previousBalance += typeTotals.previousBalance;
            grandTotals.debit += typeTotals.debit;
            grandTotals.credit += typeTotals.credit;
            grandTotals.totalBalance += typeTotals.totalBalance;

            // Only add account types that have accounts with data
            if (accountsWithData.length > 0) {
                resultAccountTypes.push({
                    _id: accountType._id,
                    type_name: accountType.type_name,
                    type_code: accountType.type_code,
                    accounts: accountsWithData,
                    totals: typeTotals
                });
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                accountTypes: resultAccountTypes,
                totals: grandTotals
            },
            grandTotals
        });

    } catch (error) {
        console.error('Error fetching display group data:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch display group data: ' + error.message
        });
    }
}