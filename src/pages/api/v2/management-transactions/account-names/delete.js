import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const ACCOUNT_DELETE_FIELD = `_id is_active modified_date modified_by`;

export default apiHandler({
    post: deleteAccount,
});

async function deleteAccount(req, res) {
    const { accountId, userId } = req.body;

    if (!accountId || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Account ID and user ID are required'
        });
    }

    try {
        const managementAccountsType = createGraphType(
            "management_accounts",
            ACCOUNT_DELETE_FIELD
        );

        // Soft delete by setting is_active to false
        const updateData = {
            is_active: false,
            modified_date: moment().toISOString(),
            modified_by: userId
        };

        const result = await graph.mutation(
            updateQl(managementAccountsType(), {
                where: { _id: { _eq: accountId } },
                _set: updateData
            })
        );

        if (result.errors) {
            return res.status(400).json({
                error: true,
                message: result.errors[0].message
            });
        }

        const account = result.data.management_accounts.returning[0];

        if (account) {
            return res.status(200).json({
                success: true,
                message: 'Account name deleted successfully'
            });
        } else {
            return res.status(404).json({
                error: true,
                message: 'Account not found'
            });
        }

    } catch (error) {
        console.error('Error deleting account name:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to delete account name: ' + error.message
        });
    }
}