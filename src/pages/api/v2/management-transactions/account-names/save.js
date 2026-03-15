import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { MANAGEMENT_ACCOUNT_FIELD } from '@/lib/graph.fields';
import { filterGraphFields } from '@/lib/graph.functions';

const graph = new GraphProvider();

export default apiHandler({ post: save });

// ── Formula validator ─────────────────────────────────────────────────────────
// Allowed variables: debit, credit, prev_balance, total_balance
//   + account reference variables: {slug}_{suffix}
// Allowed operators: + - * / ( ) and numbers
const ACCOUNT_REF_SUFFIX_KEYS = [
    'sc_prev_balance', 'sc_total_balance', 'sc_debit', 'sc_credit',
    'prev_balance', 'total_balance', 'debit', 'credit',
];

function validateFormula(formula) {
    if (!formula || typeof formula !== 'string') return { valid: false, message: 'Formula is required' };
    const trimmed = formula.trim();
    if (!trimmed.length) return { valid: false, message: 'Formula cannot be empty' };
    if (trimmed.length > 500) return { valid: false, message: 'Formula is too long (max 500 characters)' };

    // Account reference patterns MUST be replaced before own-row variables.
    // e.g. loan_receivables_prev_balance — if "prev_balance" is stripped first,
    // "loan_receivables_1" remains and the account-ref pattern never matches.
    let test = trimmed;

    for (const suffix of ACCOUNT_REF_SUFFIX_KEYS) {
        test = test.replace(new RegExp(`[a-z][a-z0-9_]*_${suffix}`, 'gi'), '1');
    }

    // Then replace remaining own-row variables
    test = test
        .replace(/prev_balance/gi,  '1')
        .replace(/total_balance/gi, '1')
        .replace(/debit/gi,         '1')
        .replace(/credit/gi,        '1');

    if (!/^[\d\s+\-*/().]+$/.test(test)) {
        return { valid: false, message: 'Formula contains invalid characters. Only variables, numbers, and operators (+, -, *, /, parentheses) are allowed.' };
    }

    let depth = 0;
    for (const char of trimmed) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (depth < 0) return { valid: false, message: 'Unbalanced parentheses in formula' };
    }
    if (depth !== 0) return { valid: false, message: 'Unbalanced parentheses in formula' };

    try {
        const testExpr = test.replace(/[a-z_][a-z0-9_]*/gi, '100');
        const result = new Function(`return ${testExpr}`)();
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            return { valid: false, message: 'Formula does not produce a valid number' };
        }
    } catch (e) {
        return { valid: false, message: 'Invalid formula syntax: ' + e.message };
    }

    return { valid: true };
}

// SC formula validator (legacy) — only allows debit and credit (no prev_balance)
function validateScFormula(formula) {
    if (!formula || typeof formula !== 'string') return { valid: false, message: 'Formula is required' };
    const trimmed = formula.trim();
    if (!trimmed.length) return { valid: false, message: 'Formula cannot be empty' };
    if (trimmed.length > 500) return { valid: false, message: 'Formula is too long (max 500 characters)' };

    const test = trimmed.replace(/debit/gi, '1').replace(/credit/gi, '1');
    if (!/^[\d\s+\-*/().]+$/.test(test)) {
        return { valid: false, message: 'SC formula: only debit, credit, numbers, and operators are allowed.' };
    }

    let depth = 0;
    for (const char of trimmed) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (depth < 0) return { valid: false, message: 'Unbalanced parentheses in formula' };
    }
    if (depth !== 0) return { valid: false, message: 'Unbalanced parentheses in formula' };

    try {
        const result = new Function(`return ${trimmed.replace(/debit/gi, '100').replace(/credit/gi, '100')}`)();
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

        // ── Service charge (transaction input page) ───────────────────────────
        // service_charge = true → transaction page shows virtual
        // "Less: Unearned Service Charges" row below this account.
        serviceCharge,
        // service_charge_formula — legacy single formula, deprecated in favour of
        // the 4 per-column formulas below. Still accepted for backward compat.
        serviceChargeFormula,

        // ── Per-column formulas (replace service_charge_formula) ──────────────
        // When service_charge=true:  drive the virtual SC row columns
        // When service_charge=false: drive this account's own computed row display
        // All 4 are always saved regardless of serviceCharge value.
        prevBalanceFormula,
        debitFormula,
        creditFormula,
        balanceFormula,

        // ── FIS report fields ─────────────────────────────────────────────────
        // rowType: 'standard' | 'formula' | 'aggregate'
        // aggregate_refs: [{ id, op: 'add'|'subtract' }]
        // indentLevel: 0 (header) | 1 (main) | 2 (sub-row)
        rowType,
        aggregateRefs,
        indentLevel,

        userId,
    } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!accountTypeId || !accountName || !userId) {
        return res.status(400).json({
            error: true,
            message: 'Account type ID, account name, and user ID are required',
        });
    }

    const validAccountGroups = ['other_receipts', 'management_expenses', 'other_payments'];
    if (accountGroups && Array.isArray(accountGroups)) {
        const invalidGroups = accountGroups.filter(g => !validAccountGroups.includes(g));
        if (invalidGroups.length > 0) {
            return res.status(400).json({
                error: true,
                message: `Invalid account group values: ${invalidGroups.join(', ')}. Valid values are: ${validAccountGroups.join(', ')}`,
            });
        }
    }

    // ── Legacy service_charge_formula validation ──────────────────────────────
    // Only validate if serviceCharge is true AND no new per-column formulas set
    // (meaning this is a legacy row not yet migrated to per-column formulas)
    const hasNewFormulas = prevBalanceFormula?.trim() || debitFormula?.trim()
        || creditFormula?.trim() || balanceFormula?.trim();

    if (serviceCharge && serviceChargeFormula?.trim() && !hasNewFormulas) {
        const check = validateScFormula(serviceChargeFormula.trim());
        if (!check.valid) {
            return res.status(400).json({ error: true, message: check.message });
        }
    }

    // ── Per-column formula validation ─────────────────────────────────────────
    for (const [label, val] of [
        ['prev_balance_formula', prevBalanceFormula],
        ['debit_formula',        debitFormula],
        ['credit_formula',       creditFormula],
        ['balance_formula',      balanceFormula],
    ]) {
        if (val?.trim()) {
            const check = validateFormula(val.trim());
            if (!check.valid) {
                return res.status(400).json({ error: true, message: `${label}: ${check.message}` });
            }
        }
    }

    // ── Row type validation (FIS report) ─────────────────────────────────────
    const validRowTypes = ['standard', 'formula', 'aggregate'];
    const resolvedRowType = rowType || 'standard';

    if (!validRowTypes.includes(resolvedRowType)) {
        return res.status(400).json({
            error: true,
            message: `row_type must be one of: ${validRowTypes.join(', ')}`,
        });
    }

    // ── Aggregate refs validation ─────────────────────────────────────────────
    if (resolvedRowType === 'aggregate') {
        if (!aggregateRefs?.length) {
            return res.status(400).json({ error: true, message: 'aggregate_refs required for aggregate row_type' });
        }
        for (const ref of aggregateRefs) {
            if (!ref.id) {
                return res.status(400).json({ error: true, message: 'Each aggregate ref must have an id' });
            }
            if (!['add', 'subtract'].includes(ref.op)) {
                return res.status(400).json({ error: true, message: "aggregate_refs op must be 'add' or 'subtract'" });
            }
        }
    }

    const resolvedIndentLevel = indentLevel !== undefined ? Number(indentLevel) : 1;

    try {
        const managementAccountsType = createGraphType('management_accounts', MANAGEMENT_ACCOUNT_FIELD);

        // Build the fields object combining all systems
        const fields = {
            account_name:   accountName,
            description:    description || null,
            account_groups: accountGroups || [],

            // ── SC fields (transaction input page) ───────────────────────────
            service_charge: Boolean(serviceCharge),
            // Keep legacy formula if provided and no new formulas set;
            // otherwise null it out (new per-column formulas take over)
            service_charge_formula: (serviceCharge && serviceChargeFormula?.trim() && !hasNewFormulas)
                ? serviceChargeFormula.trim()
                : null,

            // ── Per-column formulas (always saved, always nullable) ───────────
            prev_balance_formula: prevBalanceFormula?.trim() || null,
            debit_formula:        debitFormula?.trim()        || null,
            credit_formula:       creditFormula?.trim()        || null,
            balance_formula:      balanceFormula?.trim()       || null,

            // ── FIS report fields ─────────────────────────────────────────────
            row_type:       resolvedRowType,
            aggregate_refs: resolvedRowType === 'aggregate' ? aggregateRefs : null,
            indent_level:   resolvedIndentLevel,
        };

        if (accountId) {
            // ── UPDATE ────────────────────────────────────────────────────────
            const result = await graph.mutation(
                updateQl(managementAccountsType(), {
                    where: { _id: { _eq: accountId } },
                    set: {
                        ...fields,
                        modified_date: moment().toISOString(),
                        modified_by:   userId,
                    },
                })
            );

            if (result.errors) {
                return res.status(400).json({ error: true, message: result.errors[0].message });
            }

            const account = result.data.management_accounts.returning[0];
            return res.status(200).json({
                success: true,
                account,
                message: 'Account name updated successfully',
            });

        } else {
            // ── INSERT — get next display_order ───────────────────────────────
            const maxOrderResult = await graph.query(`
                query GetMaxOrder($accountTypeId: String!) {
                    management_accounts(
                        where: { account_type_id: { _eq: $accountTypeId } }
                        order_by: { display_order: desc }
                        limit: 1
                    ) { display_order }
                }
            `, { accountTypeId });

            const maxOrder = maxOrderResult?.data?.management_accounts?.[0]?.display_order ?? -1;

            const accountData = {
                _id:             generateUUID(),
                account_type_id: accountTypeId,
                ...fields,
                display_order:   maxOrder + 1,
                is_active:       true,
                date_added:      moment(getCurrentDate()).format('YYYY-MM-DD'),
                inserted_date:   moment().toISOString(),
                inserted_by:     userId,
            };

            const result = await graph.mutation(
                insertQl(managementAccountsType(), {
                    objects: [filterGraphFields(MANAGEMENT_ACCOUNT_FIELD, accountData)],
                })
            );

            if (result.errors) {
                return res.status(400).json({ error: true, message: result.errors[0].message });
            }

            const account = result.data.management_accounts.returning[0];
            return res.status(200).json({
                success: true,
                account,
                message: 'Account name created successfully',
            });
        }

    } catch (error) {
        console.error('Error saving account name:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to save account name: ' + error.message,
        });
    }
}