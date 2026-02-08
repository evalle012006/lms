import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { MANAGEMENT_ACCOUNT_FIELD } from '@/lib/graph.fields';
import moment from 'moment';

const graph = new GraphProvider();

export default apiHandler({
    post: reorder,
});

async function reorder(req, res) {
    const { accountNames, userId } = req.body;

    // Validation
    if (!accountNames || !Array.isArray(accountNames) || accountNames.length === 0) {
        return res.status(400).json({
            error: true,
            message: 'Account names array is required'
        });
    }

    if (!userId) {
        return res.status(400).json({
            error: true,
            message: 'User ID is required'
        });
    }

    try {
        const managementAccountsType = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

        // Update each account name's display_order
        const updatePromises = accountNames.map((accountName, index) => {
            return graph.mutation(
                updateQl(managementAccountsType(), {
                    where: { _id: { _eq: accountName._id } },
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
            message: 'Account names reordered successfully'
        });

    } catch (error) {
        console.error('Error reordering account names:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to reorder account names: ' + error.message
        });
    }
}