import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { MANAGEMENT_ACCOUNT_TYPE_FIELD } from '@/lib/graph.fields';
import { filterGraphFields } from '@/lib/graph.functions';

const graph = new GraphProvider();

export default apiHandler({
    post: save,
});

async function save(req, res) {
    const { typeId, typeName, typeCode, description, displayOrder, accountGroup, displayGroup, userId } = req.body;

    // Validation
    if (!typeName || !typeCode || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Type name, type code, and user ID are required'
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

    // Validate display_group value if provided
    const validDisplayGroups = ['', 'assets', 'liabilities', 'management_expenses'];
    if (displayGroup && !validDisplayGroups.includes(displayGroup)) {
        return res.status(400).json({
            error: true,
            message: 'Invalid display group value. Valid values are: assets, liabilities, management_expenses'
        });
    }

    try {
        const managementAccountTypesType = createGraphType(
            "management_account_types",
            MANAGEMENT_ACCOUNT_TYPE_FIELD
        );

        if (typeId) {
            // UPDATE existing account type
            const updateData = {
                type_name: typeName,
                description: description || null,
                display_order: displayOrder || 0,
                account_group: accountGroup || null,
                display_group: displayGroup || null,
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

            return res.status(200).json({
                success: true,
                accountType: accountType,
                message: 'Account type updated successfully'
            });

        } else {
            // INSERT new account type
            const accountTypeData = {
                _id: generateUUID(),
                type_name: typeName,
                type_code: typeCode,
                description: description || null,
                display_order: displayOrder || 0,
                account_group: accountGroup || null,
                display_group: displayGroup || null,
                is_active: true,
                date_added: moment(getCurrentDate()).format('YYYY-MM-DD'),
                inserted_date: moment().toISOString(),
                inserted_by: userId
            };

            const result = await graph.mutation(
                insertQl(managementAccountTypesType(), {
                    objects: [filterGraphFields(MANAGEMENT_ACCOUNT_TYPE_FIELD, accountTypeData)]
                })
            );

            if (result.errors) {
                return res.status(400).json({
                    error: true,
                    message: result.errors[0].message
                });
            }

            const accountType = result.data.management_account_types.returning[0];

            return res.status(200).json({
                success: true,
                accountType: accountType,
                message: 'Account type created successfully'
            });
        }

    } catch (error) {
        console.error('Error saving account type:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to save account type: ' + error.message
        });
    }
}