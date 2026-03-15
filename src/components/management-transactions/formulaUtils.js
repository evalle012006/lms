export const slugifyName = (name) =>
    (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ── Formula evaluator ─────────────────────────────────────────────────────────
// Variables: debit, credit, prev_balance, total_balance (own-row values)
//            + context keys (other accounts' slug-based computed values)
// Returns null if formula is empty/invalid; caller uses ?? 0 or ?? rawValue
export const evaluateFormula = (formula, debit, credit, prevBalance, totalBalance, context = {}) => {
    if (!formula || typeof formula !== 'string' || !formula.trim()) return null;
    try {
        // Longest-first to prevent partial replacements (e.g. loan_receivables_debit before debit)
        const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
        let expression = formula;
        for (const key of sortedKeys) {
            expression = expression.replace(new RegExp(key, 'gi'), String(parseFloat(context[key]) || 0));
        }
        expression = expression
            .replace(/prev_balance/gi,  String(parseFloat(prevBalance)  || 0))
            .replace(/total_balance/gi, String(parseFloat(totalBalance) || 0))
            .replace(/debit/gi,         String(parseFloat(debit)        || 0))
            .replace(/credit/gi,        String(parseFloat(credit)       || 0));

        if (!/^[\d\s+\-*/().]+$/.test(expression)) return null;
        const result = new Function(`return ${expression}`)();
        return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
        return null;
    }
};

// ── Build account context + display values ────────────────────────────────────
//
// Returns:
//   context      — flat map of { slug_suffix: value } for ALL accounts
//                  used so later formulas can reference earlier accounts
//   displayValues — map of { accountId: { prevBalance, debit, credit, total } }
//                  only populated for non-SC formula accounts (these render as
//                  computed read-only rows in the transaction page)
//
// Two-pass algorithm:
//   Pass 1 — seed raw values + SC computed values into context
//   Pass 2 — compute non-SC formula accounts (can reference Pass 1 context)
export const buildAccountContext = (accounts, newTransactions) => {
    const context      = {};
    const displayValues = {};

    // ── Pass 1 ────────────────────────────────────────────────────────────────
    for (const acct of accounts) {
        const slug      = slugifyName(acct.account_name);
        const rawDebit  = parseFloat(newTransactions[acct._id]?.debit          || 0);
        const rawCredit = parseFloat(newTransactions[acct._id]?.credit         || 0);
        const rawPrev   = parseFloat(newTransactions[acct._id]?.previousBalance || 0);
        const rawTotal  = rawPrev + rawDebit - rawCredit;

        // Seed raw values (always available for other accounts to reference)
        context[`${slug}_debit`]         = rawDebit;
        context[`${slug}_credit`]        = rawCredit;
        context[`${slug}_prev_balance`]  = rawPrev;
        context[`${slug}_total_balance`] = rawTotal;

        // Compute SC values — SC rows use no context (no circular refs)
        const hasNewFormulas = acct.prev_balance_formula || acct.debit_formula
            || acct.credit_formula || acct.balance_formula;

        let sPrev = 0, sDebit = 0, sCredit = 0, sBalance = 0;

        if (acct.service_charge && hasNewFormulas) {
            sPrev    = evaluateFormula(acct.prev_balance_formula, rawDebit, rawCredit, rawPrev, rawTotal) ?? 0;
            sDebit   = evaluateFormula(acct.debit_formula,        rawDebit, rawCredit, rawPrev, rawTotal) ?? 0;
            sCredit  = evaluateFormula(acct.credit_formula,       rawDebit, rawCredit, rawPrev, rawTotal) ?? 0;
            sBalance = evaluateFormula(acct.balance_formula,      rawDebit, rawCredit, rawPrev, rawTotal) ?? (sDebit - sCredit);
        } else if (acct.service_charge && acct.service_charge_formula) {
            // Legacy single-formula fallback
            const usesDebit  = /debit/i.test(acct.service_charge_formula);
            const usesCredit = /credit/i.test(acct.service_charge_formula);
            const res        = evaluateFormula(acct.service_charge_formula, rawDebit, rawCredit, rawPrev, rawTotal) ?? 0;
            sDebit   = (usesDebit  && rawDebit  > 0) ? res : 0;
            sCredit  = (usesCredit && rawCredit > 0) ? res : 0;
            sBalance = sDebit - sCredit;
        }

        context[`${slug}_sc_prev_balance`]  = sPrev;
        context[`${slug}_sc_debit`]         = sDebit;
        context[`${slug}_sc_credit`]        = sCredit;
        context[`${slug}_sc_total_balance`] = sBalance;
    }

    // ── Pass 2 — non-SC formula accounts (use full context from Pass 1) ───────
    for (const acct of accounts) {
        // Skip SC accounts (handled above) and pure standard accounts (no formulas)
        if (acct.service_charge) continue;
        const hasFormulas = acct.prev_balance_formula || acct.debit_formula
            || acct.credit_formula || acct.balance_formula;
        if (!hasFormulas) continue;

        const slug      = slugifyName(acct.account_name);
        const rawDebit  = parseFloat(newTransactions[acct._id]?.debit          || 0);
        const rawCredit = parseFloat(newTransactions[acct._id]?.credit         || 0);
        const rawPrev   = parseFloat(newTransactions[acct._id]?.previousBalance || 0);
        const rawTotal  = rawPrev + rawDebit - rawCredit;

        // Compute display values — falls back to raw if formula is blank
        const dispPrev   = evaluateFormula(acct.prev_balance_formula, rawDebit, rawCredit, rawPrev, rawTotal, context) ?? rawPrev;
        const dispDebit  = evaluateFormula(acct.debit_formula,        rawDebit, rawCredit, rawPrev, rawTotal, context) ?? rawDebit;
        const dispCredit = evaluateFormula(acct.credit_formula,       rawDebit, rawCredit, rawPrev, rawTotal, context) ?? rawCredit;
        const dispTotal  = evaluateFormula(acct.balance_formula,      rawDebit, rawCredit, rawPrev, rawTotal, context)
            ?? (dispPrev + dispDebit - dispCredit);

        displayValues[acct._id] = { prevBalance: dispPrev, debit: dispDebit, credit: dispCredit, total: dispTotal };

        // Update context so subsequent accounts can reference this computed result
        context[`${slug}_debit`]         = dispDebit;
        context[`${slug}_credit`]        = dispCredit;
        context[`${slug}_prev_balance`]  = dispPrev;
        context[`${slug}_total_balance`] = dispTotal;
    }

    return { context, displayValues };
};

// ── Compute SC virtual row for a single account ───────────────────────────────
// Returns { scPrevBalance, scDebit, scCredit, scBalance, shouldShow }
export const computeScRow = (account, debitValue, creditValue, prevBalValue, totalBalValue, context) => {
    const hasNewFormulas = account.prev_balance_formula || account.debit_formula
        || account.credit_formula || account.balance_formula;
    const hasLegacyFormula = account.service_charge_formula && !hasNewFormulas;

    let scPrevBalance = 0, scDebit = 0, scCredit = 0, scBalance = 0;

    if (hasNewFormulas) {
        scPrevBalance = evaluateFormula(account.prev_balance_formula, debitValue, creditValue, prevBalValue, totalBalValue, context) ?? 0;
        scDebit       = evaluateFormula(account.debit_formula,         debitValue, creditValue, prevBalValue, totalBalValue, context) ?? 0;
        scCredit      = evaluateFormula(account.credit_formula,        debitValue, creditValue, prevBalValue, totalBalValue, context) ?? 0;
        scBalance     = evaluateFormula(account.balance_formula,       debitValue, creditValue, prevBalValue, totalBalValue, context) ?? (scDebit - scCredit);
    } else if (hasLegacyFormula) {
        const usesDebit    = /debit/i.test(account.service_charge_formula);
        const usesCredit   = /credit/i.test(account.service_charge_formula);
        const legacyResult = evaluateFormula(account.service_charge_formula, debitValue, creditValue, prevBalValue, totalBalValue, context) ?? 0;
        scDebit   = (usesDebit  && debitValue  > 0) ? legacyResult : 0;
        scCredit  = (usesCredit && creditValue > 0) ? legacyResult : 0;
        scBalance = scDebit - scCredit;
    }

    // SC row always visible when service_charge=true and any formula is configured
    const shouldShow = account.service_charge && (hasNewFormulas || hasLegacyFormula);

    return { scPrevBalance, scDebit, scCredit, scBalance, shouldShow };
};