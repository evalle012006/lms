// lib/fis-row-evaluator.js
// Processes management_accounts rows into FIS report columns.
// Used by the FIS report API endpoint.

// ── Safe formula evaluator ────────────────────────────────────────────────────
// Variables available: prev_balance, debit, credit
// Returns 0 on any error (never throws)
function evalFormula(formula, vars) {
    if (!formula?.trim()) return null; // null = use default/passthrough
    try {
        const fn = new Function(
            'prev_balance', 'debit', 'credit',
            `"use strict"; return (${formula});`
        );
        const result = fn(
            vars.prev_balance ?? 0,
            vars.debit ?? 0,
            vars.credit ?? 0
        );
        return typeof result === 'number' && isFinite(result) ? result : 0;
    } catch {
        return 0;
    }
}

// ── Compute a single standard or formula row ──────────────────────────────────
// Returns { prev_balance, debit, credit, current_balance } — all display values
export function computeAccountRow(account, raw) {
    const rawPrev   = raw.prev_balance ?? 0;
    const rawDebit  = raw.debit ?? 0;
    const rawCredit = raw.credit ?? 0;

    if (account.row_type === 'standard' || !account.row_type) {
        // Standard: display raw values, balance = prev + debit - credit
        return {
            prev_balance:    rawPrev,
            debit:           rawDebit,
            credit:          rawCredit,
            current_balance: rawPrev + rawDebit - rawCredit,
        };
    }

    // row_type = 'formula'
    // Step 1: transform each column independently using raw values
    const vars = { prev_balance: rawPrev, debit: rawDebit, credit: rawCredit };

    const displayPrev   = evalFormula(account.prev_balance_formula, vars) ?? rawPrev;
    const displayDebit  = evalFormula(account.debit_formula, vars)         ?? rawDebit;
    const displayCredit = evalFormula(account.credit_formula, vars)        ?? rawCredit;

    // Step 2: compute current balance using the TRANSFORMED values
    // balance_formula receives the already-transformed prev/debit/credit
    const balanceVars = {
        prev_balance: displayPrev,
        debit:        displayDebit,
        credit:       displayCredit,
    };
    const currentBalance = evalFormula(account.balance_formula, balanceVars)
        ?? (displayPrev + displayDebit - displayCredit);

    return {
        prev_balance:    displayPrev,
        debit:           displayDebit,
        credit:          displayCredit,
        current_balance: currentBalance,
    };
}

// ── Compute an aggregate row (TOTAL / Principal rows) ─────────────────────────
// aggregate_refs: [{ id: account_name_id, op: 'add' | 'subtract' }]
// computedRows:   { [account_name_id]: { prev_balance, debit, credit, current_balance } }
export function computeAggregateRow(aggregateRefs, computedRows) {
    const totals = { prev_balance: 0, debit: 0, credit: 0, current_balance: 0 };

    for (const ref of aggregateRefs) {
        const row = computedRows[ref.id];
        if (!row) continue;
        const sign = ref.op === 'subtract' ? -1 : 1;
        totals.prev_balance    += sign * (row.prev_balance    ?? 0);
        totals.debit           += sign * (row.debit           ?? 0);
        totals.credit          += sign * (row.credit          ?? 0);
        totals.current_balance += sign * (row.current_balance ?? 0);
    }

    return totals;
}

// ── Build full FIS row list ───────────────────────────────────────────────────
// accountNames: ordered management_accounts rows (from DB, ordered by display_order)
// rawData:      { [account_name_id]: { prev_balance, debit, credit } } — raw DB aggregates
//
// Returns array of FISRow:
// { _id, account_name, indent_level, row_type, is_service_charge,
//   prev_balance, debit, credit, current_balance }
export function buildFISRows(accountNames, rawData) {
    // Pass 1: compute standard + formula rows
    const computed = {}; // id → computed columns

    for (const acct of accountNames) {
        if (acct.row_type === 'aggregate') continue;
        const raw = rawData[acct._id] ?? { prev_balance: 0, debit: 0, credit: 0 };
        computed[acct._id] = computeAccountRow(acct, raw);
    }

    // Pass 2: resolve aggregate rows (they depend on pass-1 results)
    for (const acct of accountNames) {
        if (acct.row_type !== 'aggregate') continue;
        if (!acct.aggregate_refs?.length) {
            computed[acct._id] = { prev_balance: 0, debit: 0, credit: 0, current_balance: 0 };
            continue;
        }
        computed[acct._id] = computeAggregateRow(acct.aggregate_refs, computed);
    }

    // Build output
    return accountNames.map(acct => ({
        _id:              acct._id,
        account_name:     acct.account_name,
        indent_level:     acct.indent_level ?? 1,
        row_type:         acct.row_type ?? 'standard',
        is_service_charge: acct.service_charge ?? false,
        ...(computed[acct._id] ?? { prev_balance: 0, debit: 0, credit: 0, current_balance: 0 }),
    }));
}

// ── Fetch raw DB aggregates for a date range ──────────────────────────────────
// Returns { [account_name_id]: { prev_balance, debit, credit } }
//
// prev_balance = net of all transactions BEFORE startDate (credit - debit)
// debit        = sum of debits in [startDate, endDate]
// credit       = sum of credits in [startDate, endDate]
export async function fetchRawFISData(graph, startDate, endDate, accountIds) {
    if (!accountIds?.length) return {};

    const result = await graph.query(`
        query FISData($ids: [String!]!, $start: date!, $end: date!) {
            period: management_transactions(
                where: {
                    account_id: { _in: $ids }
                    date_added: { _gte: $start, _lte: $end }
                }
            ) { account_id debit credit }

            previous: management_transactions(
                where: {
                    account_id: { _in: $ids }
                    date_added: { _lt: $start }
                }
            ) { account_id debit credit }
        }
    `, { ids: accountIds, start: startDate, end: endDate });

    const raw = {};
    accountIds.forEach(id => { raw[id] = { prev_balance: 0, debit: 0, credit: 0 }; });

    // Previous period → running balance (credit increases, debit decreases)
    for (const t of result?.data?.previous ?? []) {
        if (!raw[t.account_id]) continue;
        raw[t.account_id].prev_balance += (parseFloat(t.credit) || 0) - (parseFloat(t.debit) || 0);
    }

    // Current period → debit and credit columns
    for (const t of result?.data?.period ?? []) {
        if (!raw[t.account_id]) continue;
        raw[t.account_id].debit  += parseFloat(t.debit)  || 0;
        raw[t.account_id].credit += parseFloat(t.credit) || 0;
    }

    return raw;
}

// ── Formula examples for reference when setting up account names ──────────────
//
// REGULAR LOAN PRODUCT (60 DAYS)
// ┌─────────────────────────────────────┬───────────────┬──────────────────────────────────────────┐
// │ Account Name                        │ row_type      │ Formulas                                 │
// ├─────────────────────────────────────┼───────────────┼──────────────────────────────────────────┤
// │ Loan Receivables                    │ standard      │ all null                                 │
// │ Less: Unearned SC (60-day)          │ formula       │ debit: debit*2/12, credit: credit*2/12   │
// │ Total Regular Loan (Principal)      │ aggregate     │ [+Loan Receivables, -Unearned SC]        │
// ├─────────────────────────────────────┼───────────────┼──────────────────────────────────────────┤
// │ Salary Advance (with S.C.)          │ standard      │ all null                                 │
// │ Less: Unearned SC (Salary Adv)      │ formula       │ debit: -(debit/11), credit: -(credit/11) │
// ├─────────────────────────────────────┼───────────────┼──────────────────────────────────────────┤
// │ TOTAL CASH ON HAND/IN BANK          │ aggregate     │ [+Cash on Hand, +Cash in Bank 1, ...]    │
// └─────────────────────────────────────┴───────────────┴──────────────────────────────────────────┘