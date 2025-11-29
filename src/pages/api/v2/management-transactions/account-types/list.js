import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MANAGEMENT_ACCOUNT_TYPE_FIELD } from "@/lib/graph.fields";

const graph = new GraphProvider();

export default apiHandler({
    get: list,
});

async function list(req, res) {
    try {
        const managementAccountTypesType = createGraphType(
            "management_account_types",
            MANAGEMENT_ACCOUNT_TYPE_FIELD
        );

        const graphRes = await graph.query(
            queryQl(managementAccountTypesType(), {
                where: { is_active: { _eq: true } },
                order_by: [{ display_order: 'asc' }, { type_name: 'asc' }]
            })
        );

        const accountTypes = graphRes?.data?.management_account_types ?? [];

        return res.status(200).json({
            success: true,
            accountTypes: accountTypes
        });

    } catch (error) {
        console.error('Error fetching account types:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch account types'
        });
    }
}