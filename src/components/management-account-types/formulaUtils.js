// Suffixes that can appear after an account slug (longest first to avoid partial matches)
const ACCOUNT_REF_SUFFIX_KEYS = [
    'sc_prev_balance', 'sc_total_balance', 'sc_debit', 'sc_credit',
    'prev_balance', 'total_balance', 'debit', 'credit',
];

/**
 * Validates a formula string client-side.
 * Allowed own-row variables: debit, credit, prev_balance, total_balance
 * Allowed account-ref variables: {account_slug}_{suffix}
 * Returns null if valid, an error string if invalid.
 *
 * IMPORTANT: account reference patterns must be replaced BEFORE own-row
 * variables, otherwise e.g. loan_receivables_prev_balance has its
 * "prev_balance" part stripped first, leaving "loan_receivables_1" which
 * then fails the account-ref pattern match.
 */
export const validateFormulaClient = (formula) => {
    if (!formula?.trim()) return null; // blank = ok (field is optional)
    const trimmed = formula.trim();

    let test = trimmed;

    // Step 1 — replace account reference patterns FIRST (longest suffix first)
    for (const suffix of ACCOUNT_REF_SUFFIX_KEYS) {
        test = test.replace(new RegExp(`[a-z][a-z0-9_]*_${suffix}`, 'gi'), '1');
    }

    // Step 2 — replace remaining own-row variables
    test = test
        .replace(/prev_balance/gi,  '1')
        .replace(/total_balance/gi, '1')
        .replace(/debit/gi,         '1')
        .replace(/credit/gi,        '1');

    if (!/^[\d\s+\-*/().]+$/.test(test)) {
        return 'Invalid characters — only variables, numbers, and operators (+  −  ×  ÷  parentheses) are allowed';
    }

    let depth = 0;
    for (const c of trimmed) {
        if (c === '(') depth++;
        if (c === ')') depth--;
        if (depth < 0) return 'Unbalanced parentheses';
    }
    if (depth !== 0) return 'Unbalanced parentheses';

    try {
        // Dry-run: replace any remaining word-like tokens with 100
        const testExpr = test.replace(/[a-z_][a-z0-9_]*/gi, '100');
        const result = new Function(`return ${testExpr}`)();
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            return 'Formula must produce a valid number';
        }
    } catch (e) {
        return 'Syntax error: ' + e.message;
    }

    return null;
};