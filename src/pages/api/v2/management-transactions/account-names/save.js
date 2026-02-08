import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { MANAGEMENT_ACCOUNT_FIELD } from '@/lib/graph.fields';
import { filterGraphFields } from '@/lib/graph.functions';

const graph = new GraphProvider();

export default apiHandler({
    post: save,
});

async function save(req, res) {
    const { accountTypeId, accountName, description, userId } = req.body;

    // Validation
    if (!accountTypeId || !accountName || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Account type ID, account name, and user ID are required'
        });
    }

    try {
        // Get the next display_order value for this account type
        const managementAccountsType = createGraphType(
            "management_accounts",
            "_id display_order"
        );

        const existingAccountsRes = await graph.query(
            queryQl(managementAccountsType(), {
                where: { 
                    account_type_id: { _eq: accountTypeId },
                    is_active: { _eq: true }
                },
                order_by: [{ display_order: 'desc' }],
                limit: 1
            })
        );

        const existingAccounts = existingAccountsRes?.data?.management_accounts ?? [];
        const nextDisplayOrder = existingAccounts.length > 0 
            ? (existingAccounts[0].display_order ?? 0) + 1 
            : 0;

        const accountData = {
            _id: generateUUID(),
            account_type_id: accountTypeId,
            account_name: accountName,
            description: description || null,
            display_order: nextDisplayOrder,
            is_active: true,
            date_added: moment(getCurrentDate()).format('YYYY-MM-DD'),
            inserted_date: moment().toISOString(),
            inserted_by: userId
        };

        const managementAccountsTypeWithFields = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

        const result = await graph.mutation(
            insertQl(managementAccountsTypeWithFields(), {
                objects: [filterGraphFields(MANAGEMENT_ACCOUNT_FIELD, accountData)]
            })
        );

        if (result.errors) {
            return res.status(400).json({
                error: true,
                message: result.errors[0].message
            });
        }

        const account = result.data.management_accounts.returning[0];

        return res.status(200).json({
            success: true,
            account: account,
            message: 'Account name created successfully'
        });

    } catch (error) {
        console.error('Error saving account name:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to save account name: ' + error.message
        });
    }
}