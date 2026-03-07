import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MANAGEMENT_ACCOUNT_TYPE_FIELD, MANAGEMENT_ACCOUNT_FIELD, MANAGEMENT_TRANSACTION_FIELD } from "@/lib/graph.fields";

const graph = new GraphProvider();

export default apiHandler({
    get: getSummary,
});

async function getSummary(req, res) {
    const { branchId, date } = req.query;

    if (!branchId || !date) {
        return res.status(400).json({
            error: true,
            message: 'Branch ID and date are required'
        });
    }

    try {
        // Fetch all active account types
        const managementAccountTypesType = createGraphType(
            "management_account_types",
            MANAGEMENT_ACCOUNT_TYPE_FIELD
        );

        const accountTypesRes = await graph.query(
            queryQl(managementAccountTypesType(), {
                where: { is_active: { _eq: true } },
                order_by: [{ display_order: 'asc' }, { type_name: 'asc' }]
            })
        );

        const accountTypes = accountTypesRes?.data?.management_account_types ?? [];

        // Fetch all active accounts (includes account-level account_groups, service_charge, interest_rate)
        const managementAccountsType = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

        const accountsRes = await graph.query(
            queryQl(managementAccountsType(), {
                where: { is_active: { _eq: true } },
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

        // Create a map of account type id to account type for quick lookup
        const accountTypeMap = {};
        accountTypes.forEach(at => {
            accountTypeMap[at._id] = at;
        });

        // Helper function to get effective groups for an account
        // Priority: account.account_groups > accountType.account_groups
        const getEffectiveGroups = (account, accountType) => {
            // Handle both array and single value formats
            const accountGroups = Array.isArray(account.account_groups) ? account.account_groups :
                                  (account.account_group ? [account.account_group] : []);
            const typeGroups = Array.isArray(accountType?.account_groups) ? accountType.account_groups :
                               (accountType?.account_group ? [accountType.account_group] : []);
            
            // If account has its own groups, use them; otherwise fall back to type groups
            return accountGroups.length > 0 ? accountGroups : typeGroups;
        };

        // Helper function to calculate service charge values
        const calculateServiceCharge = (account, txData) => {
            if (!account.service_charge || !account.interest_rate || account.interest_rate <= 0) {
                return null;
            }
            
            const rate = parseFloat(account.interest_rate) || 0;
            const scDebit = -(txData.debit * rate);
            const scCredit = -(txData.credit * rate);
            const scTotal = scDebit - scCredit;
            
            return {
                _id: `${account._id}_sc`,
                account_name: 'Less: Unearned Service Charges',
                is_service_charge: true,
                parent_account_id: account._id,
                previous_balance: 0,
                debit: scDebit,
                credit: scCredit,
                total_balance: scTotal
            };
        };

        // Group accounts by their EFFECTIVE account_groups
        const groupedData = {
            other_receipts: { 
                accountTypes: [], 
                totals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 } 
            },
            management_expenses: { 
                accountTypes: [], 
                totals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 } 
            },
            other_payments: { 
                accountTypes: [], 
                totals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 } 
            }
        };

        // Grand totals for all groups
        const grandTotals = {
            previousBalance: 0,
            debit: 0,
            credit: 0,
            totalBalance: 0
        };

        // Group accounts by their effective groups
        const accountsByEffectiveGroup = {
            other_receipts: [],
            management_expenses: [],
            other_payments: []
        };

        accounts.forEach(account => {
            const txData = transactionMap[account._id];
            if (!txData) return;
            
            // Only include if any value is > 0 or total is not 0
            if (!(txData.previous_balance > 0 || txData.debit > 0 || txData.credit > 0 || txData.total_balance !== 0)) {
                return;
            }

            // Determine effective groups (can be multiple)
            const accountType = accountTypeMap[account.account_type_id];
            const effectiveGroups = getEffectiveGroups(account, accountType);

            // Add to each group the account belongs to
            effectiveGroups.forEach(groupCode => {
                if (accountsByEffectiveGroup[groupCode]) {
                    accountsByEffectiveGroup[groupCode].push({
                        ...account,
                        accountType: accountType,
                        txData: txData,
                        effectiveGroup: groupCode
                    });
                }
            });
        });

        // Now organize accounts by account type within each group
        Object.keys(accountsByEffectiveGroup).forEach(groupCode => {
            const groupAccounts = accountsByEffectiveGroup[groupCode];
            
            // Group accounts by account type
            const accountsByType = {};
            groupAccounts.forEach(account => {
                const typeId = account.account_type_id;
                if (!accountsByType[typeId]) {
                    accountsByType[typeId] = {
                        accountType: account.accountType,
                        accounts: []
                    };
                }
                
                // Check if this account is already added (avoid duplicates from same account in same type)
                const alreadyAdded = accountsByType[typeId].accounts.some(a => a._id === account._id);
                if (!alreadyAdded) {
                    // Add the main account
                    accountsByType[typeId].accounts.push({
                        _id: account._id,
                        account_name: account.account_name,
                        description: account.description,
                        account_groups: account.account_groups,
                        service_charge: account.service_charge,
                        interest_rate: account.interest_rate,
                        ...account.txData
                    });
                    
                    // If account has service charge, add the service charge row
                    const scRow = calculateServiceCharge(account, account.txData);
                    if (scRow) {
                        accountsByType[typeId].accounts.push(scRow);
                    }
                }
            });

            // Convert to array and calculate totals
            Object.values(accountsByType).forEach(typeData => {
                if (typeData.accounts.length === 0) return;

                const typeTotals = typeData.accounts.reduce((acc, account) => {
                    acc.previousBalance += account.previous_balance;
                    acc.debit += account.debit;
                    acc.credit += account.credit;
                    acc.totalBalance += account.total_balance;
                    return acc;
                }, { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 });

                groupedData[groupCode].accountTypes.push({
                    _id: typeData.accountType._id,
                    type_name: typeData.accountType.type_name,
                    type_code: typeData.accountType.type_code,
                    accounts: typeData.accounts,
                    totals: typeTotals
                });

                // Add to group totals
                groupedData[groupCode].totals.previousBalance += typeTotals.previousBalance;
                groupedData[groupCode].totals.debit += typeTotals.debit;
                groupedData[groupCode].totals.credit += typeTotals.credit;
                groupedData[groupCode].totals.totalBalance += typeTotals.totalBalance;

                // Add to grand totals
                grandTotals.previousBalance += typeTotals.previousBalance;
                grandTotals.debit += typeTotals.debit;
                grandTotals.credit += typeTotals.credit;
                grandTotals.totalBalance += typeTotals.totalBalance;
            });
        });

        return res.status(200).json({
            success: true,
            summaryData: groupedData,
            grandTotals
        });

    } catch (error) {
        console.error('Error fetching summary data:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch summary data: ' + error.message
        });
    }
}