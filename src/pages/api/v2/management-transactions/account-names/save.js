import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
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
        const accountData = {
            _id: generateUUID(),
            account_type_id: accountTypeId,
            account_name: accountName,
            description: description || null,
            is_active: true,
            date_added: moment(getCurrentDate()).format('YYYY-MM-DD'),
            inserted_date: moment().toISOString(),
            inserted_by: userId
        };

        const managementAccountsType = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

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

    } catch (error) {
        console.error('Error saving account name:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to save account name: ' + error.message
        });
    }
}