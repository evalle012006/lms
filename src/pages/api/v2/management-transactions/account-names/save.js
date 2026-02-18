import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { MANAGEMENT_ACCOUNT_FIELD } from '@/lib/graph.fields';
import { filterGraphFields } from '@/lib/graph.functions';

const graph = new GraphProvider();

export default apiHandler({
    post: save,
});

async function save(req, res) {
    const { accountId, accountTypeId, accountName, description, accountGroup, userId } = req.body;

    // Validation
    if (!accountTypeId || !accountName || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Account type ID, account name, and user ID are required'
        });
    }

    // Validate account_group value if provided
    const validAccountGroups = ['', 'other_receipts', 'management_expenses', 'other_payments'];
    if (accountGroup && !validAccountGroups.includes(accountGroup)) {
        return res.status(400).json({
            error: true,
            message: 'Invalid account group value. Valid values are: other_receipts, management_expenses, other_payments'
        });
    }

    try {
        const managementAccountsType = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

        if (accountId) {
            // UPDATE existing account name
            const updateData = {
                account_name: accountName,
                description: description || null,
                account_group: accountGroup || null,
                modified_date: moment().toISOString(),
                modified_by: userId
            };

            const result = await graph.mutation(
                updateQl(managementAccountsType(), {
                    where: { _id: { _eq: accountId } },
                    set: updateData
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
                message: 'Account name updated successfully'
            });

        } else {
            // INSERT new account name
            // Get the max display_order for this account type
            const maxOrderResult = await graph.query(`
                query GetMaxOrder($accountTypeId: String!) {
                    management_accounts(
                        where: { account_type_id: { _eq: $accountTypeId } }
                        order_by: { display_order: desc }
                        limit: 1
                    ) {
                        display_order
                    }
                }
            `, { accountTypeId });

            const maxOrder = maxOrderResult?.data?.management_accounts?.[0]?.display_order ?? -1;

            const accountData = {
                _id: generateUUID(),
                account_type_id: accountTypeId,
                account_name: accountName,
                description: description || null,
                account_group: accountGroup || null,
                display_order: maxOrder + 1,
                is_active: true,
                date_added: moment(getCurrentDate()).format('YYYY-MM-DD'),
                inserted_date: moment().toISOString(),
                inserted_by: userId
            };

            const result = await graph.mutation(
                insertQl(managementAccountsType(), {
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
        }

    } catch (error) {
        console.error('Error saving account name:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to save account name: ' + error.message
        });
    }
}