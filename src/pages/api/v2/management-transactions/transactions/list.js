import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import moment from 'moment';

const graph = new GraphProvider();

// Simplified fields without relationships
const TRANSACTION_FIELDS_SIMPLE = `
    _id
    transaction_type
    branch_id
    account_id
    amount
    date_added
    inserted_date
    inserted_by
    modified_date
    modified_by
    remarks
`;

const ACCOUNT_FIELDS = `
    _id
    account_name
`;

const USER_FIELDS = `
    _id
    firstName
    lastName
`;

export default apiHandler({
    get: list,
});

async function list(req, res) {
    const { transactionType, branchId, dateFrom, dateTo } = req.query;

    if (!transactionType) {
        return res.status(400).json({
            error: true,
            message: 'Transaction type is required'
        });
    }

    try {
        // Build where clause
        let where = {
            transaction_type: { _eq: transactionType }
        };
        
        if (branchId) {
            where.branch_id = { _eq: branchId };
        }
        
        // Validate and format dates
        if (dateFrom && dateFrom !== 'Invalid date' && dateTo && dateTo !== 'null') {
            const formattedDateFrom = moment(dateFrom, 'YYYY-MM-DD', true);
            const formattedDateTo = moment(dateTo, 'YYYY-MM-DD', true);
            
            if (formattedDateFrom.isValid() && formattedDateTo.isValid()) {
                where.date_added = {
                    _gte: formattedDateFrom.format('YYYY-MM-DD'),
                    _lte: formattedDateTo.format('YYYY-MM-DD')
                };
            }
        }

        const orderBy = [{ date_added: 'desc' }, { inserted_date: 'desc' }];

        // Query transactions without relationships
        const managementTransactionsType = createGraphType(
            "management_transactions",
            TRANSACTION_FIELDS_SIMPLE
        );

        const graphRes = await graph.query(
            queryQl(managementTransactionsType(), {
                where: where,
                order_by: orderBy
            })
        );

        const transactions = graphRes?.data?.management_transactions ?? [];

        // Get unique account IDs and user IDs
        const accountIds = [...new Set(transactions.map(t => t.account_id).filter(Boolean))];
        const userIds = [...new Set(transactions.map(t => t.inserted_by).filter(Boolean))];

        // Fetch accounts separately if there are any
        let accountsMap = {};
        if (accountIds.length > 0) {
            const accountsType = createGraphType("management_accounts", ACCOUNT_FIELDS);
            const accountsRes = await graph.query(
                queryQl(accountsType(), {
                    where: { _id: { _in: accountIds } }
                })
            );
            const accounts = accountsRes?.data?.management_accounts ?? [];
            accountsMap = accounts.reduce((map, acc) => {
                map[acc._id] = acc;
                return map;
            }, {});
        }

        // Fetch users separately if there are any
        let usersMap = {};
        if (userIds.length > 0) {
            const usersType = createGraphType("users", USER_FIELDS);
            const usersRes = await graph.query(
                queryQl(usersType(), {
                    where: { _id: { _in: userIds } }
                })
            );
            const users = usersRes?.data?.users ?? [];
            usersMap = users.reduce((map, user) => {
                map[user._id] = user;
                return map;
            }, {});
        }

        // Merge the data manually
        const enrichedTransactions = transactions.map(transaction => ({
            ...transaction,
            account: accountsMap[transaction.account_id] || null,
            inserted_by_user: usersMap[transaction.inserted_by] || null
        }));

        // Calculate grand total
        const grandTotal = enrichedTransactions.reduce((sum, transaction) => {
            return sum + parseFloat(transaction.amount || 0);
        }, 0);

        return res.status(200).json({
            success: true,
            transactions: enrichedTransactions,
            grandTotal: grandTotal,
            count: enrichedTransactions.length
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch transactions: ' + error.message
        });
    }
}