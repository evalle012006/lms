import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { BRANCH_FIELDS } from "@/lib/graph.fields";
import moment from 'moment';

const graph = new GraphProvider();

const TRANSACTION_FIELDS = `
    _id
    transaction_type
    branch_id
    account_id
    previous_balance
    debit
    credit
    total_balance
    date_added
`;

/**
 * Convert type_code to snake_case slug
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
    get: getAggregated,
});

async function getAggregated(req, res) {
    const { transactionType, date, branchIds } = req.query;

    if (!transactionType || !date) {
        return res.status(400).json({
            error: true,
            message: 'Transaction type and date are required'
        });
    }

    try {
        // Get account type for slug conversion
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

        const transactionTypeSlug = getTransactionTypeSlug(
            accountType.type_code,
            accountType.type_name
        );

        const formattedDate = moment(date).format('YYYY-MM-DD');

        // Parse branch IDs filter
        const branchIdsArray = branchIds ? branchIds.split(',').filter(Boolean) : [];

        // Build where clause for branches - ALWAYS exclude B000
        let branchWhere = {
            code: { _neq: 'B000' }
        };

        if (branchIdsArray.length > 0) {
            branchWhere._id = { _in: branchIdsArray };
        }

        // Get all branches (excluding B000) for the filter UI
        const branchesType = createGraphType("branches", BRANCH_FIELDS);
        const allBranchesRes = await graph.query(
            queryQl(branchesType(), {
                where: { code: { _neq: 'B000' } },
                order_by: [{ code: 'asc' }]
            })
        );
        const allBranches = allBranchesRes?.data?.branches || [];

        // Get filtered branches for data display
        const filteredBranchesRes = await graph.query(
            queryQl(branchesType(), {
                where: branchWhere,
                order_by: [{ code: 'asc' }]
            })
        );
        const filteredBranches = filteredBranchesRes?.data?.branches || [];

        if (filteredBranches.length === 0) {
            return res.status(200).json({
                success: true,
                aggregatedData: [],
                grandTotals: {
                    previousBalance: 0,
                    debit: 0,
                    credit: 0,
                    totalBalance: 0
                },
                availableBranches: allBranches
            });
        }

        const branchIdsToQuery = filteredBranches.map(b => b._id);

        // Query transactions
        const managementTransactionsType = createGraphType(
            "management_transactions",
            TRANSACTION_FIELDS
        );

        const transactionsRes = await graph.query(
            queryQl(managementTransactionsType(), {
                where: {
                    transaction_type: { _eq: transactionTypeSlug },
                    date_added: { _eq: formattedDate },
                    branch_id: { _in: branchIdsToQuery }
                }
            })
        );

        const transactions = transactionsRes?.data?.management_transactions || [];

        // Aggregate by branch
        const branchAggregateMap = {};
        
        transactions.forEach(transaction => {
            const branchId = transaction.branch_id;
            
            if (!branchAggregateMap[branchId]) {
                branchAggregateMap[branchId] = {
                    previousBalance: 0,
                    debit: 0,
                    credit: 0,
                    totalBalance: 0
                };
            }
            
            branchAggregateMap[branchId].previousBalance += parseFloat(transaction.previous_balance) || 0;
            branchAggregateMap[branchId].debit += parseFloat(transaction.debit) || 0;
            branchAggregateMap[branchId].credit += parseFloat(transaction.credit) || 0;
            branchAggregateMap[branchId].totalBalance += parseFloat(transaction.total_balance) || 0;
        });

        // Create aggregated data
        const aggregatedData = filteredBranches.map(branch => {
            const branchData = branchAggregateMap[branch._id] || {
                previousBalance: 0,
                debit: 0,
                credit: 0,
                totalBalance: 0
            };

            return {
                branchId: branch._id,
                branchCode: branch.code,
                branchName: branch.name,
                branchDisplay: `${branch.code} - ${branch.name}`,
                previousBalance: branchData.previousBalance,
                debit: branchData.debit,
                credit: branchData.credit,
                totalBalance: branchData.totalBalance
            };
        });

        // Calculate grand totals
        const grandTotals = aggregatedData.reduce((totals, item) => {
            totals.previousBalance += item.previousBalance;
            totals.debit += item.debit;
            totals.credit += item.credit;
            totals.totalBalance += item.totalBalance;
            return totals;
        }, {
            previousBalance: 0,
            debit: 0,
            credit: 0,
            totalBalance: 0
        });

        return res.status(200).json({
            success: true,
            aggregatedData: aggregatedData,
            grandTotals: grandTotals,
            availableBranches: allBranches
        });

    } catch (error) {
        console.error('Error fetching aggregated data:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch aggregated data: ' + error.message
        });
    }
}