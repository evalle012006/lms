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

// Validate service charge formula
// Allowed: debit, credit, numbers, operators (+, -, *, /), parentheses, spaces, decimal points
function validateFormula(formula) {
    if (!formula || typeof formula !== 'string') {
        return { valid: false, message: 'Formula is required' };
    }
    
    const trimmed = formula.trim();
    if (trimmed.length === 0) {
        return { valid: false, message: 'Formula cannot be empty' };
    }
    
    if (trimmed.length > 255) {
        return { valid: false, message: 'Formula is too long (max 255 characters)' };
    }
    
    // Check for only allowed characters: debit, credit, numbers, operators, parentheses, spaces, dots
    // First, replace valid tokens with placeholders
    let testFormula = trimmed
        .replace(/debit/gi, '1')
        .replace(/credit/gi, '1');
    
    // Check if only valid characters remain: numbers, operators, parentheses, spaces, dots
    const validPattern = /^[\d\s+\-*/().]+$/;
    if (!validPattern.test(testFormula)) {
        return { valid: false, message: 'Formula contains invalid characters. Only debit, credit, numbers, and operators (+, -, *, /, parentheses) are allowed.' };
    }
    
    // Check for balanced parentheses
    let depth = 0;
    for (const char of trimmed) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (depth < 0) {
            return { valid: false, message: 'Unbalanced parentheses in formula' };
        }
    }
    if (depth !== 0) {
        return { valid: false, message: 'Unbalanced parentheses in formula' };
    }
    
    // Try to evaluate with test values to check syntax
    try {
        const testEval = trimmed
            .replace(/debit/gi, '100')
            .replace(/credit/gi, '100');
        // Use Function constructor for safer eval
        const result = new Function(`return ${testEval}`)();
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            return { valid: false, message: 'Formula does not produce a valid number' };
        }
    } catch (e) {
        return { valid: false, message: 'Invalid formula syntax: ' + e.message };
    }
    
    return { valid: true };
}

async function save(req, res) {
    const { 
        accountId, 
        accountTypeId, 
        accountName, 
        description, 
        accountGroups, 
        serviceCharge,
        serviceChargeFormula,
        userId 
    } = req.body;

    // Validation
    if (!accountTypeId || !accountName || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Account type ID, account name, and user ID are required'
        });
    }

    // Validate account_groups values if provided
    const validAccountGroups = ['other_receipts', 'management_expenses', 'other_payments'];
    if (accountGroups && Array.isArray(accountGroups)) {
        const invalidGroups = accountGroups.filter(g => !validAccountGroups.includes(g));
        if (invalidGroups.length > 0) {
            return res.status(400).json({
                error: true,
                message: `Invalid account group values: ${invalidGroups.join(', ')}. Valid values are: ${validAccountGroups.join(', ')}`
            });
        }
    }

    // Validate formula if service_charge is true
    if (serviceCharge) {
        const formulaValidation = validateFormula(serviceChargeFormula);
        if (!formulaValidation.valid) {
            return res.status(400).json({
                error: true,
                message: formulaValidation.message
            });
        }
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
                account_groups: accountGroups || [],
                service_charge: serviceCharge || false,
                service_charge_formula: serviceCharge ? serviceChargeFormula.trim() : null,
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
                account_groups: accountGroups || [],
                service_charge: serviceCharge || false,
                service_charge_formula: serviceCharge ? serviceChargeFormula.trim() : null,
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