import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MANAGEMENT_ACCOUNT_FIELD } from "@/lib/graph.fields";

const graph = new GraphProvider();

export default apiHandler({
    get: list,
});

async function list(req, res) {
    const { accountTypeId, accountType } = req.query;

    // Accept either accountTypeId (UUID) or accountType (type code string)
    if (!accountTypeId && !accountType) {
        return res.status(400).json({
            error: true,
            message: 'Either account type ID or account type is required'
        });
    }

    try {
        let finalAccountTypeId = accountTypeId;

        // If accountType string is provided, look up the UUID first
        if (!accountTypeId && accountType) {
            // Query to get the account type ID using type_code
            const accountTypeType = createGraphType(
                "management_account_types",
                "_id type_code type_name"
            );

            const typeRes = await graph.query(
                queryQl(accountTypeType(), {
                    where: { 
                        type_code: { _eq: accountType },
                        is_active: { _eq: true }
                    },
                    limit: 1
                })
            );

            const accountTypeRecord = typeRes?.data?.management_account_types?.[0];

            if (!accountTypeRecord) {
                return res.status(404).json({
                    error: true,
                    message: `Account type not found for code: ${accountType}`,
                    accountType: accountType
                });
            }

            finalAccountTypeId = accountTypeRecord._id;
        }

        // Now query the accounts using the account type ID
        const managementAccountsType = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

        const graphRes = await graph.query(
            queryQl(managementAccountsType(), {
                where: { 
                    account_type_id: { _eq: finalAccountTypeId },
                    is_active: { _eq: true } 
                },
                // Updated to order by display_order first, then account_name
                order_by: [{ display_order: 'asc' }, { account_name: 'asc' }]
            })
        );

        const accountNames = graphRes?.data?.management_accounts ?? [];

        return res.status(200).json({
            success: true,
            accounts: accountNames,
            accountNames: accountNames,
            count: accountNames.length
        });

    } catch (error) {
        console.error('Error fetching account names:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch account names: ' + error.message
        });
    }
}