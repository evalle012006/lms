import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { MANAGEMENT_ACCOUNT_TYPE_FIELD, MANAGEMENT_ACCOUNT_FIELD, MANAGEMENT_TRANSACTION_FIELD } from "@/lib/graph.fields";

const graph = new GraphProvider();

export default apiHandler({
    get: getSummary,
});

// ── Formula evaluator ─────────────────────────────────────────────────────────
// Variables: prev_balance, debit, credit — operators: + - * / ( )
// Returns null if formula is empty/invalid (caller uses raw value as fallback)
const evalFormula = (formula, vars) => {
    if (!formula || typeof formula !== 'string' || !formula.trim()) return null;
    try {
        const expr = formula
            .replace(/prev_balance/gi, String(vars.prev_balance ?? 0))
            .replace(/debit/gi,        String(vars.debit        ?? 0))
            .replace(/credit/gi,       String(vars.credit       ?? 0));
        if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
        const result = new Function(`return ${expr}`)();
        return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
        return null;
    }
};

// ── Compute display columns for a single account row ──────────────────────────
const computeRowValues = (account, raw) => {
    const rawPrev   = parseFloat(raw.prev_balance) || 0;
    const rawDebit  = parseFloat(raw.debit)        || 0;
    const rawCredit = parseFloat(raw.credit)       || 0;

    if (!account.row_type || account.row_type === 'standard') {
        return {
            previous_balance: rawPrev,
            debit:            rawDebit,
            credit:           rawCredit,
            total_balance:    rawPrev + rawDebit - rawCredit,
        };
    }

    // row_type === 'formula': transform each column independently
    const vars = { prev_balance: rawPrev, debit: rawDebit, credit: rawCredit };
    const displayPrev   = evalFormula(account.prev_balance_formula, vars) ?? rawPrev;
    const displayDebit  = evalFormula(account.debit_formula,        vars) ?? rawDebit;
    const displayCredit = evalFormula(account.credit_formula,       vars) ?? rawCredit;

    // balance_formula receives already-transformed values
    const balanceVars  = { prev_balance: displayPrev, debit: displayDebit, credit: displayCredit };
    const totalBalance = evalFormula(account.balance_formula, balanceVars)
        ?? (displayPrev + displayDebit - displayCredit);

    return {
        previous_balance: displayPrev,
        debit:            displayDebit,
        credit:           displayCredit,
        total_balance:    totalBalance,
    };
};

// ── Compute aggregate row from already-computed sibling rows ──────────────────
const computeAggregateRowValues = (aggregateRefs, computedMap) => {
    const totals = { previous_balance: 0, debit: 0, credit: 0, total_balance: 0 };
    for (const ref of aggregateRefs) {
        const row  = computedMap[ref.id];
        if (!row) continue;
        const sign = ref.op === 'subtract' ? -1 : 1;
        totals.previous_balance += sign * (row.previous_balance ?? 0);
        totals.debit            += sign * (row.debit            ?? 0);
        totals.credit           += sign * (row.credit           ?? 0);
        totals.total_balance    += sign * (row.total_balance    ?? 0);
    }
    return totals;
};

// ── Helper: check if formula string uses a variable ───────────────────────────
const formulaUsesVariable = (formula, variable) => {
    if (!formula) return false;
    return new RegExp(variable, 'gi').test(formula);
};

// ── Legacy service charge row (for rows not yet migrated to per-column formulas)
// Kept for backward compatibility: fires only when service_charge=true
// AND debit_formula/credit_formula are still null
const calculateServiceCharge = (account, txData) => {
    if (!account.service_charge || !account.service_charge_formula) return null;
    // Skip if already migrated to new per-column formula system
    if (account.debit_formula || account.credit_formula) return null;

    const formulaUsesDebit  = formulaUsesVariable(account.service_charge_formula, 'debit');
    const formulaUsesCredit = formulaUsesVariable(account.service_charge_formula, 'credit');

    const shouldShow = (formulaUsesDebit  && txData.debit  > 0) ||
                       (formulaUsesCredit && txData.credit > 0);
    if (!shouldShow) return null;

    const vars         = { prev_balance: 0, debit: txData.debit, credit: txData.credit };
    const formulaResult = evalFormula(account.service_charge_formula, vars) ?? 0;

    const scDebit  = (formulaUsesDebit  && txData.debit  > 0) ? formulaResult : 0;
    const scCredit = (formulaUsesCredit && txData.credit > 0) ? formulaResult : 0;

    return {
        _id:               `${account._id}_sc`,
        account_name:      'Less: Unearned Service Charges',
        is_service_charge: true,
        parent_account_id: account._id,
        previous_balance:  0,
        debit:             scDebit,
        credit:            scCredit,
        total_balance:     scDebit - scCredit,
    };
};

async function getSummary(req, res) {
    const { branchId, date } = req.query;

    if (!branchId || !date) {
        return res.status(400).json({
            error: true,
            message: 'Branch ID and date are required'
        });
    }

    try {
        // Fetch all active account types
        const managementAccountTypesType = createGraphType(
            "management_account_types",
            MANAGEMENT_ACCOUNT_TYPE_FIELD
        );

        const accountTypesRes = await graph.query(
            queryQl(managementAccountTypesType(), {
                where: { is_active: { _eq: true } },
                order_by: [{ display_order: 'asc' }, { type_name: 'asc' }]
            })
        );

        const accountTypes = accountTypesRes?.data?.management_account_types ?? [];

        // Fetch all active accounts
        const managementAccountsType = createGraphType(
            "management_accounts",
            MANAGEMENT_ACCOUNT_FIELD
        );

        const accountsRes = await graph.query(
            queryQl(managementAccountsType(), {
                where: { is_active: { _eq: true } },
                order_by: [{ display_order: 'asc' }, { account_name: 'asc' }]
            })
        );

        const accounts = accountsRes?.data?.management_accounts ?? [];

        // Fetch all transactions for the branch and date
        const managementTransactionsType = createGraphType(
            "management_transactions",
            MANAGEMENT_TRANSACTION_FIELD
        );

        const transactionsRes = await graph.query(
            queryQl(managementTransactionsType(), {
                where: {
                    branch_id: { _eq: branchId },
                    date_added: { _eq: date }
                }
            })
        );

        const transactions = transactionsRes?.data?.management_transactions ?? [];

        // Create a map of account_id to raw transaction data
        const transactionMap = {};
        transactions.forEach(t => {
            transactionMap[t.account_id] = {
                prev_balance: parseFloat(t.previous_balance) || 0,
                debit:        parseFloat(t.debit)            || 0,
                credit:       parseFloat(t.credit)           || 0,
            };
        });

        // Create a map of account type id to account type for quick lookup
        const accountTypeMap = {};
        accountTypes.forEach(at => { accountTypeMap[at._id] = at; });

        // ── Pass 1: compute standard + formula rows ───────────────────────────
        // Only accounts that have transactions (summary = transactions-only view)
        const computedMap = {};

        accounts.forEach(account => {
            if (account.row_type === 'aggregate') return;
            const raw = transactionMap[account._id];
            if (!raw) return; // no transaction data — skip
            computedMap[account._id] = computeRowValues(account, raw);
        });

        // ── Pass 2: compute aggregate rows ────────────────────────────────────
        accounts.forEach(account => {
            if (account.row_type !== 'aggregate') return;
            if (!account.aggregate_refs?.length) return;
            // Only include if at least one referenced row has computed data
            const hasData = account.aggregate_refs.some(ref => computedMap[ref.id]);
            if (!hasData) return;
            computedMap[account._id] = computeAggregateRowValues(account.aggregate_refs, computedMap);
        });

        // Helper: get effective groups for an account
        // Priority: account.account_groups > accountType.account_groups
        const getEffectiveGroups = (account, accountType) => {
            const accountGroups = Array.isArray(account.account_groups) ? account.account_groups :
                                  (account.account_group ? [account.account_group] : []);
            const typeGroups = Array.isArray(accountType?.account_groups) ? accountType.account_groups :
                               (accountType?.account_group ? [accountType.account_group] : []);
            return accountGroups.length > 0 ? accountGroups : typeGroups;
        };

        // Group accounts by their EFFECTIVE account_groups
        const groupedData = {
            other_receipts: {
                accountTypes: [],
                totals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 }
            },
            management_expenses: {
                accountTypes: [],
                totals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 }
            },
            other_payments: {
                accountTypes: [],
                totals: { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 }
            }
        };

        const grandTotals = {
            previousBalance: 0,
            debit: 0,
            credit: 0,
            totalBalance: 0
        };

        const accountsByEffectiveGroup = {
            other_receipts: [],
            management_expenses: [],
            other_payments: []
        };

        accounts.forEach(account => {
            // Only include accounts that have computed values
            const computed = computedMap[account._id];
            if (!computed) return;

            // Only include if any value is non-zero
            if (!(computed.previous_balance || computed.debit || computed.credit || computed.total_balance)) return;

            const accountType = accountTypeMap[account.account_type_id];
            const effectiveGroups = getEffectiveGroups(account, accountType);

            effectiveGroups.forEach(groupCode => {
                if (accountsByEffectiveGroup[groupCode]) {
                    accountsByEffectiveGroup[groupCode].push({
                        ...account,
                        accountType,
                        computed,
                    });
                }
            });
        });

        // Now organize accounts by account type within each group
        Object.keys(accountsByEffectiveGroup).forEach(groupCode => {
            const groupAccounts = accountsByEffectiveGroup[groupCode];

            const accountsByType = {};
            groupAccounts.forEach(account => {
                const typeId = account.account_type_id;
                if (!accountsByType[typeId]) {
                    accountsByType[typeId] = {
                        accountType: account.accountType,
                        accounts: []
                    };
                }

                const alreadyAdded = accountsByType[typeId].accounts.some(a => a._id === account._id);
                if (!alreadyAdded) {
                    // Add the main account with computed column values
                    accountsByType[typeId].accounts.push({
                        _id:               account._id,
                        account_name:      account.account_name,
                        description:       account.description,
                        account_groups:    account.account_groups,
                        service_charge:    account.service_charge,
                        service_charge_formula: account.service_charge_formula,
                        row_type:          account.row_type,
                        indent_level:      account.indent_level ?? 1,
                        ...account.computed,
                    });

                    // Legacy SC row injection (backward compat for pre-migration rows)
                    const raw = transactionMap[account._id];
                    if (raw) {
                        const scRow = calculateServiceCharge(account, raw);
                        if (scRow) accountsByType[typeId].accounts.push(scRow);
                    }
                }
            });

            // Convert to array and calculate totals
            Object.values(accountsByType).forEach(typeData => {
                if (typeData.accounts.length === 0) return;

                const typeTotals = typeData.accounts.reduce((acc, account) => {
                    acc.previousBalance += account.previous_balance ?? 0;
                    acc.debit           += account.debit            ?? 0;
                    acc.credit          += account.credit           ?? 0;
                    acc.totalBalance    += account.total_balance     ?? 0;
                    return acc;
                }, { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 });

                groupedData[groupCode].accountTypes.push({
                    _id:       typeData.accountType._id,
                    type_name: typeData.accountType.type_name,
                    type_code: typeData.accountType.type_code,
                    accounts:  typeData.accounts,
                    totals:    typeTotals
                });

                groupedData[groupCode].totals.previousBalance += typeTotals.previousBalance;
                groupedData[groupCode].totals.debit           += typeTotals.debit;
                groupedData[groupCode].totals.credit          += typeTotals.credit;
                groupedData[groupCode].totals.totalBalance    += typeTotals.totalBalance;

                grandTotals.previousBalance += typeTotals.previousBalance;
                grandTotals.debit           += typeTotals.debit;
                grandTotals.credit          += typeTotals.credit;
                grandTotals.totalBalance    += typeTotals.totalBalance;
            });
        });

        return res.status(200).json({
            success: true,
            summaryData: groupedData,
            grandTotals
        });

    } catch (error) {
        console.error('Error fetching summary data:', error);
        return res.status(500).json({
            error: true,
            message: 'Failed to fetch summary data: ' + error.message
        });
    }
}