import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const ACCOUNT_TYPE_DELETE_FIELD = `_id is_active modified_date modified_by`;

export default apiHandler({
    post: deleteAccountType,
});

async function deleteAccountType(req, res) {
    const { typeId, userId } = req.body;

    if (!typeId || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Type ID and user ID are required'
        });
    }

    try {
        const managementAccountTypesType = createGraphType(
            "management_account_types",
            ACCOUNT_TYPE_DELETE_FIELD
        );

        // Soft delete by setting is_active to false
        const updateData = {
            is_active: false,
            modified_date: moment().toISOString(),
            modified_by: userId
        };

        const result = await graph.mutation(
            updateQl(managementAccountTypesType(), {
                where: { _id: { _eq: typeId } },
                set: updateData
            })
        );

        if (result.errors) {
            return res.status(400).json({
                error: true,
                message: result.errors[0].message
            });
        }

        const accountType = result.data.management_account_types.returning[0];

        if (accountType) {
            return res.status(200).json({
                success: true,
                message: 'Account type deleted successfully'
            });
        } else {
            return res.status(404).json({
                error: true,
                message: 'Account type not found'
            });
        }

    } catch (error) {
        console.error('Error deleting account type:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to delete account type: ' + error.message
        });
    }
}