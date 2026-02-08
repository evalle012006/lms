import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { MANAGEMENT_ACCOUNT_TYPE_FIELD } from '@/lib/graph.fields';
import moment from 'moment';

const graph = new GraphProvider();

export default apiHandler({
    post: reorder,
});

async function reorder(req, res) {
    const { accountTypes, userId } = req.body;

    // Validation
    if (!accountTypes || !Array.isArray(accountTypes) || accountTypes.length === 0) {
        return res.status(400).json({
            error: true,
            message: 'Account types array is required'
        });
    }

    if (!userId) {
        return res.status(400).json({
            error: true,
            message: 'User ID is required'
        });
    }

    try {
        const managementAccountTypesType = createGraphType(
            "management_account_types",
            MANAGEMENT_ACCOUNT_TYPE_FIELD
        );

        // Update each account type's display_order
        const updatePromises = accountTypes.map((accountType, index) => {
            return graph.mutation(
                updateQl(managementAccountTypesType(), {
                    where: { _id: { _eq: accountType._id } },
                    set: {
                        display_order: index,
                        modified_date: moment().toISOString(),
                        modified_by: userId
                    }
                })
            );
        });

        await Promise.all(updatePromises);

        return res.status(200).json({
            success: true,
            message: 'Account types reordered successfully'
        });

    } catch (error) {
        console.error('Error reordering account types:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to reorder account types: ' + error.message
        });
    }
}